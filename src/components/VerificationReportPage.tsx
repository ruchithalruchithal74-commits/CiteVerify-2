import { Download, ExternalLink, FileCheck2, ShieldAlert } from 'lucide-react';
import type { DocumentReport } from '../types.ts';
import {
  formatBytes,
  formatShortDate,
  NLI_COLORS,
  VERDICT_COLORS,
  VERDICT_SYMBOLS,
} from '../utils/verdicts.ts';

interface VerificationReportPageProps {
  report: DocumentReport | null;
  onExportPdf: () => void;
  onGoUpload: () => void;
}

export function VerificationReportPage({
  report,
  onExportPdf,
  onGoUpload,
}: VerificationReportPageProps) {
  if (!report) {
    return (
      <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-12 text-center max-w-2xl mx-auto mt-8">
        <FileCheck2 className="w-10 h-10 text-[#19B887] mx-auto mb-4" />
        <h2 className="font-display text-2xl font-semibold text-[#F4F1E8]">
          No verification report available
        </h2>
        <p className="text-sm text-[#A3B5A9] mt-2">
          Analyze a PDF/TXT document or run the Sample Demonstration paper to generate an auditable verification report.
        </p>
        <button
          type="button"
          onClick={onGoUpload}
          className="mt-6 px-5 py-2.5 rounded-lg bg-[#19B887] text-[#0B1411] text-sm font-semibold hover:bg-[#1FD099] transition-colors cursor-pointer"
        >
          Go to Document Upload
        </button>
      </div>
    );
  }

  const s = report.summaryStats;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Report Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-[#24312C]">
        <div>
          <p className="font-mono text-xs text-[#D6B875] mb-1">
            Structured Verification Dossier · {report.reportId}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F1E8]">
            Final Verification Report
          </h1>
          <p className="text-xs text-[#A3B5A9] mt-1.5">
            {report.filename} · {report.fileType} · {report.extractionMethod} · Auditor: {report.userDisplayName} · {formatBytes(report.fileSizeBytes)} · Generated{' '}
            {formatShortDate(report.uploadedAt)}
          </p>
        </div>

        <button
          type="button"
          onClick={onExportPdf}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#19B887] text-[#0B1411] text-sm font-semibold hover:bg-[#1FD099] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Download PDF Report
        </button>
      </div>

      {/* Executive Summary Metrics Grid */}
      <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
        <h2 className="font-display text-lg font-semibold text-[#F4F1E8] mb-4">
          Document Audit Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs font-mono tabular-nums">
          <div className="p-3 rounded-lg bg-[#141D1A] border border-[#24312C]">
            <p className="text-[#A3B5A9] font-sans">Extracted Claims</p>
            <p className="text-xl font-semibold text-[#F4F1E8] mt-1">{s.totalClaims}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#141D1A] border border-[#24312C]">
            <p className="text-[#A3B5A9] font-sans">Total Citations</p>
            <p className="text-xl font-semibold text-[#D6B875] mt-1">{s.citationsFound}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#141D1A] border border-[#24312C]">
            <p className="text-[#A3B5A9] font-sans">Verified Publications</p>
            <p className="text-xl font-semibold text-[#19B887] mt-1">{s.verifiedSources}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#141D1A] border border-[#24312C]">
            <p className="text-[#A3B5A9] font-sans">Supported</p>
            <p className="text-xl font-semibold text-[#22C58B] mt-1">{s.supportedClaims}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#141D1A] border border-[#24312C]">
            <p className="text-[#A3B5A9] font-sans">Partially Supported</p>
            <p className="text-xl font-semibold text-[#E9AC45] mt-1">{s.partiallySupportedClaims}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#141D1A] border border-[#24312C]">
            <p className="text-[#A3B5A9] font-sans">Unsupported</p>
            <p className="text-xl font-semibold text-[#F07867] mt-1">{s.unsupportedClaims}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#141D1A] border border-[#24312C]">
            <p className="text-[#A3B5A9] font-sans">Contradictory</p>
            <p className="text-xl font-semibold text-[#E05265] mt-1">{s.contradictoryClaims}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#141D1A] border border-[#24312C]">
            <p className="text-[#A3B5A9] font-sans">OA Full Text Used</p>
            <p className="text-xl font-semibold text-[#19B887] mt-1">{s.fullTextSources || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#141D1A] border border-[#24312C]">
            <p className="text-[#A3B5A9] font-sans">Needs Human Review</p>
            <p className="text-xl font-semibold text-[#56B4D3] mt-1">{s.claimsNeedingReview}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#141D1A] border border-[#24312C]">
            <p className="text-[#A3B5A9] font-sans">Figures Analyzed</p>
            <p className="text-xl font-semibold text-[#D6B875] mt-1">{s.figuresAnalyzed || 0}</p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#25322D] flex items-start gap-2.5 text-xs text-[#A3B5A9]">
          <ShieldAlert className="w-4 h-4 text-[#D6B875] shrink-0 mt-0.5" />
          <span>
            Automated findings reflect evidence retrieved from OpenAlex, Crossref, Unpaywall, Europe PMC full text, and NLI evaluation; final academic determinations remain the responsibility of qualified human reviewers.
          </span>
        </div>
      </div>

      {report.figuresAnalyzed && report.figuresAnalyzed.length > 0 && (
        <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-[#F4F1E8]">
            Figures & Graphs Vision Audit ({report.figuresAnalyzed.length})
          </h2>
          <div className="space-y-3">
            {report.figuresAnalyzed.map((f) => (
              <div
                key={f.figureId}
                className="rounded-lg border border-[#24312C] bg-[#141D1A] p-4 text-xs space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span className="text-[#D6B875] font-semibold">
                    {f.figureId} · {f.chartType}
                  </span>
                  <span
                    style={{
                      color:
                        f.claimAlignmentStatus === 'Discrepancy Detected'
                          ? '#E05265'
                          : '#22C58B',
                    }}
                  >
                    {f.claimAlignmentStatus}
                  </span>
                </div>
                <p className="text-sm font-medium text-[#F4F1E8]">{f.title}</p>
                <p className="text-[#A3B5A9]">{f.keyFinding}</p>
                {f.claimAlignmentNote && (
                  <p className="text-[#A3B5A9] italic">{f.claimAlignmentNote}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim-by-Claim Structured Dossier */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-[#F4F1E8]">
          Claim-by-Claim Evidence Ledger
        </h2>

        {report.claims.map((claim) => (
          <article
            key={claim.id}
            className="rounded-xl border border-[#25322D] bg-[#1C2623] p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#25322D]">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono font-semibold text-[#D6B875]">
                  {claim.id}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className="font-semibold"
                  style={{ color: VERDICT_COLORS[claim.verdict] }}
                >
                  {VERDICT_SYMBOLS[claim.verdict]} VERDICT: {claim.verdict}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#A3B5A9]">
                <span>
                  Confidence:{' '}
                  <strong className="text-[#F4F1E8]">{claim.confidenceIndicator}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[#56B4D3]">
                  Human Review: {claim.humanReview.decision}
                </span>
              </div>
            </div>

            <dl className="space-y-3 text-xs sm:text-sm">
              <div>
                <dt className="font-mono text-[11px] text-[#A3B5A9]">CLAIM</dt>
                <dd className="text-[#F4F1E8] font-medium mt-0.5">
                  {claim.claimText}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[11px] text-[#A3B5A9]">CITATION</dt>
                <dd className="text-[#F4F1E8]/90 mt-0.5">
                  {claim.matchedCitation}
                  {claim.bibliographyEntry?.rawText
                    ? ` — ${claim.bibliographyEntry.rawText}`
                    : ''}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[11px] text-[#A3B5A9]">
                  EVIDENCE ({claim.source.passageSource})
                </dt>
                <dd className="text-[#F4F1E8]/90 mt-0.5 leading-relaxed">
                  {claim.source.relevantPassage ||
                    claim.source.retrievalNote ||
                    'Unavailable — no source passage could be retrieved.'}
                </dd>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <dt className="font-mono text-[11px] text-[#A3B5A9]">NLI RESULT</dt>
                  <dd
                    className="font-mono text-xs font-semibold mt-0.5"
                    style={{ color: NLI_COLORS[claim.nli.label] }}
                  >
                    {claim.nli.label}
                    {claim.nli.confidence !== null
                      ? ` (${Math.round(claim.nli.confidence * 100)}%)`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] text-[#A3B5A9]">SOURCE TRACE</dt>
                  <dd className="mt-0.5">
                    {claim.source.doi && !claim.source.isIllustrativeDemo ? (
                      <a
                        href={`https://doi.org/${claim.source.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-[#19B887] hover:underline break-all"
                      >
                        https://doi.org/{claim.source.doi}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : claim.source.sourceUrl && !claim.source.isIllustrativeDemo ? (
                      <a
                        href={claim.source.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-[#19B887] hover:underline break-all"
                      >
                        {claim.source.sourceUrl}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-[#A3B5A9]">
                        {claim.source.isIllustrativeDemo
                          ? 'Illustrative Demo Corpus (Synthetic)'
                          : 'Unavailable'}
                      </span>
                    )}
                  </dd>
                </div>
              </div>

              <div>
                <dt className="font-mono text-[11px] text-[#A3B5A9]">REASON & CONFIDENCE NOTE</dt>
                <dd className="text-[#A3B5A9] mt-0.5 leading-relaxed">
                  {claim.reason} ({claim.confidenceExplanation})
                </dd>
              </div>

              {claim.humanReview.comments && (
                <div className="rounded-lg border border-[#56B4D3]/30 bg-[#141D1A] p-3">
                  <dt className="font-mono text-[11px] text-[#56B4D3]">
                    HUMAN REVIEWER NOTES ({claim.humanReview.decision})
                  </dt>
                  <dd className="text-xs text-[#F4F1E8] mt-1">
                    {claim.humanReview.comments}
                  </dd>
                </div>
              )}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
