import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type { DocumentReport, HumanReviewDecision } from './src/types.ts';
import {
  GOLDEN_BENCHMARK_DATASET,
  runAutomatedBenchmark,
} from './server/benchmark.ts';
import {
  ensureUser,
  listBenchmarkRunsFromDb,
  listUsers,
  recordClaimReviewInDb,
} from './server/db.ts';
import { extractDocumentText } from './server/extractors.ts';
import {
  getAllReports,
  getReportById,
  runVerificationPipeline,
} from './server/pipeline.ts';
import { lookupOriginalResearch } from './server/researchApi.ts';
import {
  SAMPLE_EXPECTED_MATRIX,
  SAMPLE_PAPER_METADATA,
  SAMPLE_PAPER_TEXT,
} from './server/samplePaper.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '4mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function inferUploadMimeType(filename: string, mimeType: string): string {
  const lower = filename.toLowerCase();
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'text/plain';
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: 'sqlite',
    geminiConfigured: Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    ),
  });
});

// Multi-user workspace profile endpoints
app.get('/api/users', (_req, res) => {
  res.json({ users: listUsers() });
});

app.post('/api/users', (req, res) => {
  const { displayName, role } = req.body as {
    displayName?: string;
    role?: string;
  };
  if (!displayName || displayName.trim().length < 2) {
    res.status(400).json({ error: 'Provide a valid researcher display name.' });
    return;
  }
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const id = `usr-${slug || Date.now()}`;
  const user = ensureUser(
    id,
    displayName.trim(),
    (role || 'Research Auditor').trim()
  );
  res.json({ user, users: listUsers() });
});

app.get('/api/sample-paper', (_req, res) => {
  res.json({
    ...SAMPLE_PAPER_METADATA,
    fileSizeBytes: Buffer.byteLength(SAMPLE_PAPER_TEXT, 'utf-8'),
    text: SAMPLE_PAPER_TEXT,
    expectedMatrix: SAMPLE_EXPECTED_MATRIX,
  });
});

app.get('/api/reports', (req, res) => {
  const userId =
    typeof req.query.userId === 'string' ? req.query.userId : undefined;
  res.json({ reports: getAllReports(userId) });
});

app.get('/api/reports/:id', (req, res) => {
  const report = getReportById(req.params.id);
  if (!report) {
    res.status(404).json({ error: 'Verification report not found.' });
    return;
  }
  res.json({ report });
});

// Preview uploaded PDF, TXT, or Image before starting verification
app.post('/api/extract-preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No document file uploaded.' });
      return;
    }
    const effectiveMime = inferUploadMimeType(
      req.file.originalname,
      req.file.mimetype
    );
    const { text, fileType, ocrUsed, extractionMethod } =
      await extractDocumentText(
        req.file.buffer,
        req.file.originalname,
        effectiveMime
      );
    res.json({
      filename: req.file.originalname,
      fileSizeBytes: req.file.size,
      fileType,
      ocrUsed,
      extractionMethod,
      totalCharacters: text.length,
      previewText: text.slice(0, 8000),
    });
  } catch (err: any) {
    res.status(400).json({
      error: err?.message || 'Failed to extract document text.',
    });
  }
});

// Streaming SSE verification endpoint (supports PDF, Scanned PDF OCR, TXT, Chart Images, Sample)
app.post('/api/verify-stream', upload.single('file'), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const useSample = req.body?.mode === 'sample';
    const userId =
      typeof req.body?.userId === 'string' && req.body.userId.trim()
        ? req.body.userId.trim()
        : 'usr-elena';
    const userDisplayName =
      typeof req.body?.userDisplayName === 'string' &&
      req.body.userDisplayName.trim()
        ? req.body.userDisplayName.trim()
        : undefined;

    let text = '';
    let filename = '';
    let fileSizeBytes = 0;
    let fileType: 'PDF' | 'TXT' | 'IMAGE' | 'SAMPLE' = 'TXT';
    let extractionMethod: DocumentReport['extractionMethod'] = 'Plain Text';
    let ocrUsed = false;
    let fileBuffer: Buffer | undefined;
    let effectiveMime: string | undefined;

    if (useSample) {
      text = SAMPLE_PAPER_TEXT;
      filename = SAMPLE_PAPER_METADATA.filename;
      fileSizeBytes = Buffer.byteLength(SAMPLE_PAPER_TEXT, 'utf-8');
      fileType = 'SAMPLE';
      extractionMethod = 'Sample';
    } else if (req.file) {
      effectiveMime = inferUploadMimeType(
        req.file.originalname,
        req.file.mimetype
      );
      const extracted = await extractDocumentText(
        req.file.buffer,
        req.file.originalname,
        effectiveMime
      );
      text = extracted.text;
      filename = req.file.originalname;
      fileSizeBytes = req.file.size;
      fileType = extracted.fileType;
      extractionMethod = extracted.extractionMethod;
      ocrUsed = extracted.ocrUsed;
      fileBuffer = req.file.buffer;
    } else if (typeof req.body?.rawText === 'string' && req.body.rawText.trim()) {
      text = req.body.rawText.trim();
      filename = req.body.filename || 'Pasted_Manuscript.txt';
      fileSizeBytes = Buffer.byteLength(text, 'utf-8');
      fileType = 'TXT';
      extractionMethod = 'Plain Text';
    } else {
      sendEvent('error', {
        error:
          'Please upload a PDF, TXT, or Figure Image file, or launch Sample Demonstration Mode.',
      });
      res.end();
      return;
    }

    const report = await runVerificationPipeline({
      text,
      filename,
      fileSizeBytes,
      fileType,
      extractionMethod,
      ocrUsed,
      fileBuffer,
      mimeType: effectiveMime,
      userId,
      userDisplayName,
      isSampleDemo: useSample,
      onProgress: (ev) => sendEvent('progress', ev),
    });

    sendEvent('complete', { report });
    res.end();
  } catch (err: any) {
    sendEvent('error', {
      error: err?.message || 'Verification pipeline encountered an unexpected error.',
    });
    res.end();
  }
});

// Human Review endpoint backed by SQLite audit trail
app.patch('/api/reports/:reportId/claims/:claimId/review', (req, res) => {
  const { decision, comments, reviewer, userId } = req.body as {
    decision?: HumanReviewDecision;
    comments?: string;
    reviewer?: string;
    userId?: string;
  };

  const existing = getReportById(req.params.reportId);
  if (!existing) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const targetClaim = existing.claims.find((c) => c.id === req.params.claimId);
  if (!targetClaim) {
    res.status(404).json({ error: 'Claim not found in report.' });
    return;
  }

  const validDecisions: HumanReviewDecision[] = [
    'Pending',
    'Reviewed',
    'Accepted',
    'Rejected',
  ];
  const nextDecision: HumanReviewDecision =
    decision && validDecisions.includes(decision)
      ? decision
      : targetClaim.humanReview.decision;

  const nextComments =
    typeof comments === 'string' ? comments.trim() : targetClaim.humanReview.comments;
  const reviewerName = (reviewer || 'Academic Reviewer').trim();
  const activeUserId = (userId || existing.userId || 'usr-elena').trim();

  const updatedReport = recordClaimReviewInDb({
    reportId: req.params.reportId,
    claimId: req.params.claimId,
    userId: activeUserId,
    reviewerName,
    decision: nextDecision,
    comments: nextComments,
  });

  if (!updatedReport) {
    res.status(500).json({ error: 'Failed to persist human review decision.' });
    return;
  }

  const updatedClaim = updatedReport.claims.find(
    (c) => c.id === req.params.claimId
  );
  res.json({ claim: updatedClaim, report: updatedReport });
});

// Live Evidence Explorer lookup endpoint (OpenAlex + Crossref + Unpaywall + Europe PMC)
app.post('/api/sources/lookup', async (req, res) => {
  try {
    const { doi, title, author, year } = req.body as {
      doi?: string;
      title?: string;
      author?: string;
      year?: number;
    };
    if (!doi && !title) {
      res.status(400).json({ error: 'Provide a DOI or publication title to look up.' });
      return;
    }
    const result = await lookupOriginalResearch({
      doi,
      title,
      authors: author ? [author] : undefined,
      year: year ? Number(year) : undefined,
    });
    res.json({ source: result.source, flags: result.flags });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Live OpenAlex/Crossref lookup failed.',
    });
  }
});

// Automated Golden Evaluation Benchmark endpoints
app.get('/api/benchmark/history', (_req, res) => {
  res.json({
    runs: listBenchmarkRunsFromDb(),
    datasetSize: GOLDEN_BENCHMARK_DATASET.length,
    datasetPreview: GOLDEN_BENCHMARK_DATASET.map((d) => ({
      id: d.id,
      domain: d.domain,
      expectedCategory: d.expectedCategory,
      claimText: d.claimText,
    })),
  });
});

app.post('/api/benchmark/run', async (req, res) => {
  try {
    const userId =
      typeof req.body?.userId === 'string' && req.body.userId.trim()
        ? req.body.userId.trim()
        : 'usr-elena';
    const run = await runAutomatedBenchmark(userId);
    res.json({ run });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Automated benchmark evaluation failed.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CiteVerify server listening on http://localhost:${PORT}`);
  });
}

startServer();
