import { jsPDF } from 'jspdf';
import type { DocumentReport } from '../types.ts';
import { formatBytes } from './verdicts.ts';

export function exportVerificationReportPdf(report: DocumentReport): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 50;
    }
  };

  const writeWrapped = (
    text: string,
    x: number,
    width: number,
    fontSize: number,
    color: [number, number, number] = [30, 38, 35],
    bold = false
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text || 'N/A', width);
    const lineHeight = fontSize * 1.38;
    for (const line of lines) {
      ensureSpace(lineHeight + 4);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  // Header Banner
  doc.setFillColor(16, 20, 20);
  doc.rect(0, 0, pageWidth, 88, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(25, 184, 135);
  doc.text('CiteVerify', margin, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(214, 184, 117);
  doc.text('Beyond Citations. Into Evidence.  |  Scientific Verification Report', margin, 54);
  doc.setFontSize(8.5);
  doc.setTextColor(163, 181, 169);
  doc.text(
    `Report ID: ${report.reportId}   Generated: ${new Date(
      report.uploadedAt
    ).toLocaleString()}`,
    margin,
    72
  );

  y = 110;

  if (report.isSampleDemo) {
    doc.setFillColor(250, 245, 232);
    doc.rect(margin, y - 12, maxWidth, 28, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(138, 102, 24);
    doc.text(
      'SAMPLE DEMONSTRATION MODE: Illustrative synthetic references are explicitly labeled and are not genuine publications.',
      margin + 8,
      y + 5
    );
    y += 30;
  }

  // Document Info & Executive Metrics
  writeWrapped('1. Document Information & Audit Summary', margin, maxWidth, 13, [20, 32, 28], true);
  y += 4;
  writeWrapped(
    `Document: ${report.filename} (${report.fileType} · ${report.extractionMethod}, ${formatBytes(report.fileSizeBytes)})   |   Auditor: ${report.userDisplayName}`,
    margin,
    maxWidth,
    10
  );
  const s = report.summaryStats;
  writeWrapped(
    `Total Extracted Claims: ${s.totalClaims}   |   Citations Found: ${s.citationsFound}   |   Verified Publications: ${s.verifiedSources}   |   OA Full-Text Sources: ${s.fullTextSources || 0}`,
    margin,
    maxWidth,
    10
  );
  writeWrapped(
    `Supported: ${s.supportedClaims}   |   Partially Supported: ${s.partiallySupportedClaims}   |   Unsupported: ${s.unsupportedClaims}   |   Contradictory: ${s.contradictoryClaims}   |   Needs Human Review: ${s.claimsNeedingReview}   |   Figures Analyzed: ${s.figuresAnalyzed || 0}`,
    margin,
    maxWidth,
    9.5,
    [60, 75, 70]
  );

  if (report.figuresAnalyzed && report.figuresAnalyzed.length > 0) {
    y += 6;
    writeWrapped('Figures & Graphs Vision Audit:', margin, maxWidth, 10, [20, 32, 28], true);
    for (const fig of report.figuresAnalyzed) {
      writeWrapped(
        `${fig.figureId} (${fig.chartType}) — ${fig.title} [${fig.claimAlignmentStatus}]: ${fig.keyFinding}`,
        margin,
        maxWidth,
        8.5,
        [50, 62, 58]
      );
    }
  }

  y += 8;
  writeWrapped(
    'Academic Integrity Notice: Automated NLI and metadata verification results are decision-support indicators and must not be treated as final academic judgment without human scholarly review.',
    margin,
    maxWidth,
    8.5,
    [100, 110, 105]
  );

  y += 14;
  doc.setDrawColor(210, 218, 215);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Claim-by-claim sections
  writeWrapped('2. Claim-by-Claim Verification Ledger', margin, maxWidth, 13, [20, 32, 28], true);
  y += 8;

  for (const claim of report.claims) {
    ensureSpace(150);

    doc.setFillColor(242, 246, 244);
    doc.rect(margin, y - 11, maxWidth, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 32, 28);
    doc.text(
      `${claim.id}  |  VERDICT: ${claim.verdict.toUpperCase()}  |  CONFIDENCE: ${claim.confidenceIndicator}`,
      margin + 8,
      y + 3
    );
    y += 20;

    writeWrapped(`CLAIM: ${claim.claimText}`, margin, maxWidth, 9.5, [20, 25, 23], true);
    writeWrapped(
      `CITATION: ${claim.matchedCitation}${
        claim.bibliographyEntry?.rawText
          ? ` — ${claim.bibliographyEntry.rawText}`
          : ''
      }`,
      margin,
      maxWidth,
      9,
      [55, 68, 63]
    );
    writeWrapped(
      `EVIDENCE (${claim.source.passageSource}): ${
        claim.source.relevantPassage ||
        claim.source.retrievalNote ||
        'Unavailable — no source passage could be retrieved.'
      }`,
      margin,
      maxWidth,
      9,
      [45, 55, 52]
    );
    writeWrapped(
      `NLI RESULT: ${claim.nli.label}${
        claim.nli.confidence !== null
          ? ` (Confidence ${(claim.nli.confidence * 100).toFixed(0)}%)`
          : ''
      } — ${claim.nli.explanation}`,
      margin,
      maxWidth,
      9,
      [45, 55, 52]
    );
    if (claim.numericalCheck.hasNumbers) {
      writeWrapped(
        `NUMERICAL INTEGRITY (${claim.numericalCheck.status}): ${claim.numericalCheck.explanation}`,
        margin,
        maxWidth,
        9,
        [45, 55, 52]
      );
    }
    if (claim.contextTrap.detected) {
      writeWrapped(
        `RESEARCH CONTEXT TRAP: ${claim.contextTrap.explanation}`,
        margin,
        maxWidth,
        9,
        [170, 60, 50]
      );
    }
    writeWrapped(
      `EVIDENCE DNA: Authenticity=${claim.evidenceDna.sourceAuthenticity.status} | Semantic=${claim.evidenceDna.semanticAlignment.status} | Numerical=${claim.evidenceDna.numericalIntegrity.status} | Context=${claim.evidenceDna.contextIntegrity.status} | Temporal=${claim.evidenceDna.temporalValidity.status}`,
      margin,
      maxWidth,
      8.5,
      [75, 90, 84]
    );
    writeWrapped(
      `REASON: ${claim.reason} (${claim.confidenceExplanation})`,
      margin,
      maxWidth,
      9,
      [30, 38, 35]
    );
    writeWrapped(
      `SOURCE TRACE: ${
        claim.source.doi
          ? `https://doi.org/${claim.source.doi}`
          : claim.source.sourceUrl || 'Unavailable'
      }`,
      margin,
      maxWidth,
      8.5,
      [25, 130, 95]
    );
    writeWrapped(
      `HUMAN REVIEW: ${claim.humanReview.decision}${
        claim.humanReview.comments ? ` — "${claim.humanReview.comments}"` : ''
      }`,
      margin,
      maxWidth,
      8.5,
      [60, 75, 70]
    );

    y += 10;
    doc.setDrawColor(225, 232, 229);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  }

  const safeName = report.filename.replace(/\.[^.]+$/, '');
  doc.save(`CiteVerify_Report_${safeName}.pdf`);
}
