import crypto from 'crypto';
import type {
  BibliographyEntry,
  CitationAuditItem,
  CitationFlag,
  ClaimAnalysis,
  DocumentReport,
  DocumentSummaryStats,
  FigureAnalysis,
  PipelineProgressEvent,
  ResearchSourceRecord,
  TimelineBucket,
} from '../src/types.ts';
import {
  analyzeDocumentFiguresAndGraphs,
  evaluateClaimsBatchWithEvidence,
  extractClaimsWithLLM,
  type BatchEvaluationInput,
} from './aiEngine.ts';
import {
  ensureUser,
  getReportFromDb,
  listReportsFromDb,
  saveReportToDb,
} from './db.ts';
import {
  detectInlineCitations,
  parseBibliographyEntries,
  splitBodyAndBibliography,
} from './extractors.ts';
import { runRuleBasedNumericalCheck } from './numberChecker.ts';
import {
  extractQueryHintsFromBib,
  lookupOriginalResearch,
  retrieveRelevantChunksForClaim,
} from './researchApi.ts';
import {
  ILLUSTRATIVE_DEMO_CORPUS,
  SAMPLE_EXPECTED_MATRIX,
} from './samplePaper.ts';

export function getAllReports(userId?: string): DocumentReport[] {
  return listReportsFromDb(userId);
}

export function getReportById(id: string): DocumentReport | undefined {
  return getReportFromDb(id);
}

export function saveReport(report: DocumentReport): void {
  saveReportToDb(report);
}

function matchCitationToBib(
  matchedCitation: string,
  bibEntries: BibliographyEntry[]
): BibliographyEntry | undefined {
  if (!matchedCitation || matchedCitation === 'None') return undefined;

  // Numbered: [1], [1, 2], (1), (1, 2)
  const numMatches = matchedCitation.match(/\b(\d{1,3})\b/g);
  if (numMatches && (matchedCitation.includes('[') || matchedCitation.includes('('))) {
    for (const numStr of numMatches) {
      const idx = Number(numStr);
      if (idx >= 1 && idx <= 500) {
        const found = bibEntries.find((b) => b.index === idx);
        if (found) return found;
      }
    }
  }

  // DOI
  const doiMatch = matchedCitation.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/);
  if (doiMatch) {
    const doiLower = doiMatch[1].toLowerCase();
    const found = bibEntries.find((b) => b.doi?.toLowerCase() === doiLower);
    if (found) return found;
  }

  // Author / Year (supports "(Smith, 2020)", "(Smith et al. 2020)", "Smith (2020)")
  const surname = matchedCitation.match(/([A-Z][a-zA-Z'-]+)/)?.[1]?.toLowerCase();
  const yearMatch = matchedCitation.match(/\b((?:19|20)\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  if (surname) {
    const exactMatch = bibEntries.find(
      (b) =>
        b.rawText.toLowerCase().includes(surname) &&
        (!year || b.year === year)
    );
    if (exactMatch) return exactMatch;

    // Fallback to surname-only match if year had minor discrepancy
    const surnameOnly = bibEntries.find((b) =>
      b.rawText.toLowerCase().includes(surname)
    );
    if (surnameOnly) return surnameOnly;
  }

  return undefined;
}

function fallbackSentenceClaimExtraction(bodyText: string) {
  const sentences = bodyText
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 500);

  const candidates = sentences.filter(
    (s) =>
      /\[\d+\]|\(\d+\)|\([A-Z][a-zA-Z'-]+.*?\d{4}\)|\d+%|\bp\s*[<>=]|\bdemonstrated\b|\bshowed\b|\bestablished\b|\bachieve[ds]?\b|\breduce[ds]?\b|\bincrease[ds]?\b/i.test(
        s
      )
  );

  const selected = candidates.length > 0 ? candidates : sentences;

  return selected.slice(0, 10).map((s) => {
    const num = s.match(/\[(\d+(?:\s*[-–,]\s*\d+)*)\]/);
    const ay = s.match(/\(([A-Z][a-zA-Z'-]+.*?,?\s*(?:19|20)\d{2})\)/);
    const citation = num?.[0] || ay?.[0] || 'None';
    const fmt: 'numbered' | 'author-year' | 'missing' = num
      ? 'numbered'
      : ay
      ? 'author-year'
      : 'missing';
    return {
      claimText: s,
      section: 'Manuscript Body',
      matchedCitation: citation,
      citationFormat: fmt,
    };
  });
}

export async function runVerificationPipeline(params: {
  text: string;
  filename: string;
  fileSizeBytes: number;
  fileType: 'PDF' | 'TXT' | 'IMAGE' | 'SAMPLE';
  extractionMethod?: DocumentReport['extractionMethod'];
  ocrUsed?: boolean;
  fileBuffer?: Buffer;
  mimeType?: string;
  userId?: string;
  userDisplayName?: string;
  isSampleDemo: boolean;
  onProgress?: (ev: PipelineProgressEvent) => void;
}): Promise<DocumentReport> {
  const {
    text,
    filename,
    fileSizeBytes,
    fileType,
    extractionMethod = fileType === 'SAMPLE'
      ? 'Sample'
      : fileType === 'PDF'
      ? 'PDF Text Layer'
      : fileType === 'IMAGE'
      ? 'Image Vision'
      : 'Plain Text',
    ocrUsed = false,
    fileBuffer,
    mimeType,
    userId = 'usr-elena',
    userDisplayName,
    isSampleDemo,
    onProgress,
  } = params;

  const activeUser = ensureUser(userId, userDisplayName);
  const pipelineWarnings: string[] = [];

  const emit = (
    stage: 1 | 2 | 3 | 4 | 5 | 6,
    stageName: string,
    detail: string,
    percent: number
  ) => {
    onProgress?.({ stage, stageName, detail, percent });
  };

  // Stage 1: Reading document
  emit(
    1,
    'Reading document',
    `Parsed ${text.length.toLocaleString()} characters via ${extractionMethod} from ${filename}`,
    12
  );

  const { bodyText, bibliographySection } = splitBodyAndBibliography(text);
  const bibliographyEntries = parseBibliographyEntries(bibliographySection);

  // Stage 2: Extracting scientific claims + Multimodal Figure/Graph Analysis (parallel when PDF/Image uploaded)
  emit(
    2,
    'Extracting scientific claims',
    fileBuffer && (fileType === 'PDF' || fileType === 'IMAGE')
      ? 'Extracting empirical claims and inspecting embedded figures, charts, and graphs with Vision AI...'
      : 'Identifying atomic empirical statements and statistical assertions...',
    28
  );

  let figuresAnalyzed: FigureAnalysis[] = [];
  const shouldInspectFigures =
    Boolean(fileBuffer) &&
    Boolean(mimeType) &&
    (fileType === 'PDF' || fileType === 'IMAGE');

  const [llmClaimResult, figureResult] = await Promise.all([
    extractClaimsWithLLM(bodyText),
    shouldInspectFigures
      ? analyzeDocumentFiguresAndGraphs(fileBuffer!, mimeType!, bodyText)
      : Promise.resolve({ figures: [] as FigureAnalysis[], warning: undefined }),
  ]);

  if (figureResult.warning) {
    pipelineWarnings.push(figureResult.warning);
  }
  figuresAnalyzed = figureResult.figures;

  let draftClaims = llmClaimResult.claims;

  // If standalone figure/chart image yielded visual findings without text sentences, synthesize claim from figure
  if (
    draftClaims.length === 0 &&
    figuresAnalyzed.length > 0
  ) {
    draftClaims = figuresAnalyzed.map((f) => ({
      claimText: `${f.figureId} (${f.title}): ${f.keyFinding}${
        f.extractedValues.length > 0
          ? ` [Values: ${f.extractedValues.join(', ')}]`
          : ''
      }`,
      section: 'Figure & Graph Analysis',
      matchedCitation: 'None',
      citationFormat: 'missing' as const,
    }));
  }

  if (llmClaimResult.error || draftClaims.length === 0) {
    if (llmClaimResult.error) {
      pipelineWarnings.push(
        `LLM Claim Extraction unavailable (${llmClaimResult.error}); used deterministic syntactic claim extraction.`
      );
    }
    if (draftClaims.length === 0) {
      draftClaims = fallbackSentenceClaimExtraction(bodyText);
    }
  }

  // Stage 3: Detecting citations
  emit(
    3,
    'Detecting citations',
    `Scanning inline [n], (n), (Author, Year), et al., and DOI patterns across ${bibliographyEntries.length} bibliography entries...`,
    44
  );

  const detectedCitations = detectInlineCitations(bodyText, bibliographyEntries);

  // Stage 4: Finding original research (OpenAlex + Crossref + Unpaywall + Europe PMC Full Text)
  emit(
    4,
    'Finding original research',
    'Querying OpenAlex, Crossref, Unpaywall, and Europe PMC for metadata, abstracts, and Open-Access full text...',
    62
  );

  const sourceCache = new Map<
    string,
    Promise<{
      source: ResearchSourceRecord;
      flags: CitationFlag[];
      fullTextBody?: string;
    }>
  >();

  function resolveCitationSource(
    matchedCitation: string,
    bibEntry?: BibliographyEntry
  ): Promise<{
    source: ResearchSourceRecord;
    flags: CitationFlag[];
    fullTextBody?: string;
  }> {
    const cacheKey = bibEntry?.rawText || matchedCitation;
    if (sourceCache.has(cacheKey)) {
      return sourceCache.get(cacheKey)!;
    }

    const promise = (async () => {
      const demoIdMatch = bibEntry?.rawText.match(
        /\[Illustrative Demo Reference ID:\s*(CV-DEMO-\d+)\]/i
      );
      if (isSampleDemo && demoIdMatch && ILLUSTRATIVE_DEMO_CORPUS[demoIdMatch[1]]) {
        const demoSource = { ...ILLUSTRATIVE_DEMO_CORPUS[demoIdMatch[1]] };
        return { source: demoSource, flags: [] as CitationFlag[] };
      }

      const hints = extractQueryHintsFromBib(bibEntry, matchedCitation);
      const result = await lookupOriginalResearch({
        ...hints,
        rawReference: bibEntry?.rawText,
      });

      if (bibEntry?.isDuplicate && !result.flags.includes('Duplicate Reference')) {
        result.flags.push('Duplicate Reference');
      }

      return result;
    })();

    sourceCache.set(cacheKey, promise);
    return promise;
  }

  const preparedClaims = await Promise.all(
    draftClaims.map(async (draft, i) => {
      const claimId = `CLM-${String(i + 1).padStart(3, '0')}`;
      const isMissingCitation =
        draft.citationFormat === 'missing' ||
        !draft.matchedCitation ||
        draft.matchedCitation === 'None';

      const bibEntry = isMissingCitation
        ? undefined
        : matchCitationToBib(draft.matchedCitation, bibliographyEntries);

      let source: ResearchSourceRecord;
      let citationFlags: CitationFlag[] = [];
      let fullTextBody: string | undefined;

      if (isMissingCitation) {
        citationFlags = ['Missing Citation'];
        source = {
          verified: false,
          openAlexFound: false,
          crossrefFound: false,
          authors: [],
          passageSource: 'Unavailable',
          retrievalNote: 'No citation attached to this claim.',
        };
      } else {
        const resolved = await resolveCitationSource(
          draft.matchedCitation,
          bibEntry
        );
        source = { ...resolved.source };
        citationFlags = [...resolved.flags];
        fullTextBody = resolved.fullTextBody;
      }

      // Retrieve semantically targeted chunks from Open-Access Full Text when available
      const chunkResult = retrieveRelevantChunksForClaim(
        draft.claimText,
        fullTextBody,
        source.abstractText,
        source.passageSource
      );

      if (chunkResult.topChunks.length > 0) {
        source.fullTextChunksUsed = chunkResult.topChunks;
        source.relevantPassage = chunkResult.topChunks[0];
      }

      const targetedPremiseText =
        chunkResult.combinedPremise || source.abstractText || '';

      const numericalCheck = runRuleBasedNumericalCheck(
        draft.claimText,
        targetedPremiseText
      );

      return {
        claimId,
        draft,
        bibEntry,
        source,
        citationFlags,
        numericalCheck,
        targetedPremiseText,
      };
    })
  );

  // Stage 5: Comparing evidence
  emit(
    5,
    'Comparing evidence',
    `Running NLI inference, numerical integrity, and Context Trap checks across ${preparedClaims.length} claims...`,
    80
  );

  const batchInputs: BatchEvaluationInput[] = preparedClaims.map((p) => ({
    claimId: p.claimId,
    claimText: p.draft.claimText,
    matchedCitation: p.draft.matchedCitation,
    citationFlags: p.citationFlags,
    source: p.source,
    numericalCheck: p.numericalCheck,
    targetedPremiseText: p.targetedPremiseText,
  }));

  const evaluationMap = await evaluateClaimsBatchWithEvidence(batchInputs);

  const claims: ClaimAnalysis[] = preparedClaims.map((p) => {
    const evaluation = evaluationMap.get(p.claimId)!;
    if (evaluation.nli.error) {
      pipelineWarnings.push(`Claim ${p.claimId} NLI error: ${evaluation.nli.error}`);
    }

    const expectedMatch = isSampleDemo
      ? SAMPLE_EXPECTED_MATRIX.find((e) =>
          p.draft.claimText.toLowerCase().includes(e.claimSubstring.toLowerCase())
        )
      : undefined;

    const finalSource: ResearchSourceRecord = {
      ...p.source,
      relevantPassage: evaluation.relevantPassage || p.source.relevantPassage,
      findings: evaluation.findings,
      limitations: evaluation.limitations,
      experimentalConditions: evaluation.experimentalConditions,
    };

    return {
      id: p.claimId,
      claimText: p.draft.claimText,
      section: p.draft.section,
      matchedCitation: p.draft.matchedCitation,
      citationFormat: p.draft.citationFormat,
      citationFlags: p.citationFlags,
      bibliographyEntry: p.bibEntry,
      source: finalSource,
      nli: evaluation.nli,
      numericalCheck: p.numericalCheck,
      contextTrap: evaluation.contextTrap,
      evidenceDna: evaluation.evidenceDna,
      verdict: evaluation.verdict,
      confidenceIndicator: evaluation.confidenceIndicator,
      confidenceExplanation: evaluation.confidenceExplanation,
      reason: evaluation.reason,
      expectedDemoOutcome: expectedMatch
        ? `${expectedMatch.caseLabel} -> Expected: ${expectedMatch.expectedVerdict} (${expectedMatch.expectedNli})`
        : undefined,
      humanReview: {
        decision: 'Pending',
        comments: '',
        history: [],
      },
    };
  });

  // Build Citation Audit summary (deduplicated)
  const uniqueDetected: typeof detectedCitations = [];
  const seenCitText = new Set<string>();
  for (const det of detectedCitations) {
    if (!seenCitText.has(det.rawText)) {
      seenCitText.add(det.rawText);
      uniqueDetected.push(det);
    }
  }
  const citationAudit: CitationAuditItem[] = await Promise.all(
    uniqueDetected.map(async (det) => {
      const resolved = await resolveCitationSource(det.rawText, det.matchedBibEntry);
      return {
        citationText: det.rawText,
        format: det.format,
        flags: resolved.flags,
        bibliographyText: det.matchedBibEntry?.rawText,
        resolvedTitle: resolved.source.title,
        doi: resolved.source.doi,
        verified: resolved.source.verified,
      };
    })
  );

  // Stage 6: Generating verification report
  emit(
    6,
    'Generating verification report',
    'Compiling Evidence DNA™ scorecards, figure analysis, source timeline, and database record...',
    96
  );

  const uniqueVerifiedSources = new Set(
    claims
      .filter((c) => c.source.verified)
      .map((c) => c.source.doi || c.source.openAlexId || c.source.title)
  );

  const uniqueFullTextSources = new Set(
    claims
      .filter((c) => c.source.fullTextRetrieved)
      .map((c) => c.source.doi || c.source.openAlexId || c.source.title)
  );

  const summaryStats: DocumentSummaryStats = {
    totalClaims: claims.length,
    citationsFound: detectedCitations.length,
    verifiedSources: uniqueVerifiedSources.size,
    fullTextSources: uniqueFullTextSources.size,
    supportedClaims: claims.filter((c) => c.verdict === 'Supported').length,
    partiallySupportedClaims: claims.filter(
      (c) => c.verdict === 'Partially Supported'
    ).length,
    unsupportedClaims: claims.filter((c) => c.verdict === 'Unsupported').length,
    contradictoryClaims: claims.filter((c) => c.verdict === 'Contradictory')
      .length,
    potentiallyOutdatedClaims: claims.filter(
      (c) => c.verdict === 'Potentially Outdated'
    ).length,
    claimsNeedingReview: claims.filter(
      (c) =>
        c.verdict === 'Human Review' ||
        c.verdict === 'Contradictory' ||
        c.verdict === 'Unsupported' ||
        c.contextTrap.detected ||
        c.numericalCheck.status === 'Mismatch'
    ).length,
    numericalMismatches: claims.filter(
      (c) => c.numericalCheck.status === 'Mismatch'
    ).length,
    contextTrapsDetected: claims.filter((c) => c.contextTrap.detected).length,
    citationIssuesCount:
      claims.filter((c) => c.citationFlags.length > 0).length +
      bibliographyEntries.filter((b) => b.isDuplicate).length,
    figuresAnalyzed: figuresAnalyzed.length,
  };

  const yearMap = new Map<number, { sources: Set<string>; verified: Set<string> }>();
  for (const c of claims) {
    const yr = c.source.year || c.bibliographyEntry?.year;
    if (!yr) continue;
    if (!yearMap.has(yr)) {
      yearMap.set(yr, { sources: new Set(), verified: new Set() });
    }
    const bucket = yearMap.get(yr)!;
    const srcKey = c.source.title || c.matchedCitation;
    bucket.sources.add(srcKey);
    if (c.source.verified) bucket.verified.add(srcKey);
  }
  const timelineData: TimelineBucket[] = Array.from(yearMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([yr, b]) => ({
      year: String(yr),
      sources: b.sources.size,
      verified: b.verified.size,
    }));

  const report: DocumentReport = {
    reportId: `REP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    userId: activeUser.id,
    userDisplayName: activeUser.displayName,
    filename,
    fileSizeBytes,
    fileType,
    extractionMethod,
    ocrUsed,
    uploadedAt: new Date().toISOString(),
    isSampleDemo,
    extractedTextPreview: text.slice(0, 6000),
    totalCharacters: text.length,
    bibliographyEntries,
    detectedCitations,
    citationAudit,
    figuresAnalyzed,
    claims,
    summaryStats,
    timelineData,
    pipelineWarnings: Array.from(new Set(pipelineWarnings)),
  };

  saveReport(report);
  emit(6, 'Generating verification report', 'Verification complete.', 100);
  return report;
}
