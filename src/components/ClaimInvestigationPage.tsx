import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ExternalLink,
  Search,
  ShieldAlert,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  ClaimAnalysis,
  DocumentReport,
  HumanReviewDecision,
  VerificationVerdict,
  WorkspaceUser,
} from '../types.ts';
import {
  formatShortDate,
  NLI_COLORS,
  VERDICT_COLORS,
  VERDICT_SYMBOLS,
} from '../utils/verdicts.ts';
import { EvidenceDnaCard } from './EvidenceDnaCard.tsx';

export type ClaimFilterOption =
  | 'All'
  | 'Supported'
  | 'Partially Supported'
  | 'Unsupported'
  | 'Contradictory'
  | 'Potentially Outdated'
  | 'Needs Human Review';

interface ClaimInvestigationPageProps {
  report: DocumentReport | null;
  activeUser: WorkspaceUser;
  initialFilter?: VerificationVerdict | 'All';
  onGoUpload: () => void;
  onInspectEvidence: (claimId: string) => void;
  onReviewUpdated: (updatedReport: DocumentReport) => void;
}

const FILTER_OPTIONS: ClaimFilterOption[] = [
  'All',
  'Supported',
  'Partially Supported',
  'Unsupported',
  'Contradictory',
  'Potentially Outdated',
  'Needs Human Review',
];

export function ClaimInvestigationPage({
  report,
  activeUser,
  initialFilter = 'All',
  onGoUpload,
  onInspectEvidence,
  onReviewUpdated,
}: ClaimInvestigationPageProps) {
  const [filter, setFilter] = useState<ClaimFilterOption>(
    initialFilter === 'Human Review' ? 'Needs Human Review' : initialFilter
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [reviewerName, setReviewerName] = useState(activeUser.displayName);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    setReviewerName(activeUser.displayName);
  }, [activeUser.id, activeUser.displayName]);

  useEffect(() => {
    setFilter(
      initialFilter === 'Human Review' ? 'Needs Human Review' : initialFilter
    );
  }, [initialFilter]);

  const filteredClaims = useMemo(() => {
    if (!report) return [];
    return report.claims.filter((c) => {
      const matchesFilter =
        filter === 'All'
          ? true
          : filter === 'Needs Human Review'
          ? c.verdict === 'Human Review' ||
            c.verdict === 'Contradictory' ||
            c.verdict === 'Unsupported' ||
            c.contextTrap.detected ||
            c.numericalCheck.status === 'Mismatch' ||
            c.humanReview.decision === 'Pending'
          : c.verdict === filter;

      if (!matchesFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.id.toLowerCase().includes(q) ||
        c.claimText.toLowerCase().includes(q) ||
        c.matchedCitation.toLowerCase().includes(q) ||
        (c.source.title || '').toLowerCase().includes(q)
      );
    });
  }, [report, filter, searchQuery]);

  const selectedClaim: ClaimAnalysis | null = useMemo(() => {
    if (!report || !selectedClaimId) return null;
    return report.claims.find((c) => c.id === selectedClaimId) || null;
  }, [report, selectedClaimId]);

  useEffect(() => {
    if (selectedClaim) {
      setCommentDraft(selectedClaim.humanReview.comments || '');
      setReviewError(null);
    }
  }, [selectedClaim?.id]);

  if (!report) {
    return (
      <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-12 text-center max-w-2xl mx-auto mt-8">
        <Search className="w-10 h-10 text-[#19B887] mx-auto mb-4" />
        <h2 className="font-display text-2xl font-semibold text-[#F4F1E8]">
          No claims loaded for investigation
        </h2>
        <p className="text-sm text-[#A3B5A9] mt-2">
          Upload a research manuscript or run the Sample Demonstration paper first.
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

  const submitHumanReview = async (decision: HumanReviewDecision) => {
    if (!selectedClaim) return;
    setSavingReview(true);
    setReviewError(null);
    try {
      const res = await fetch(
        `/api/reports/${report.reportId}/claims/${selectedClaim.id}/review`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            comments: commentDraft,
            reviewer: reviewerName,
            userId: activeUser.id,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save review.');
      onReviewUpdated(data.report);
    } catch (err: any) {
      setReviewError(err?.message || 'Unable to save human review decision.');
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F1E8]">
          Claim Investigation Engine
        </h1>
        <p className="text-sm text-[#A3B5A9] mt-1">
          Select any extracted scientific claim to inspect its Evidence DNA™, Natural Language Inference premise, numerical integrity, and Context Trap diagnostics.
        </p>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#14201C] border border-[#24322D]">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setFilter(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#19B887] text-[#0B1411] font-semibold'
                    : 'text-[#A3B5A9] hover:text-[#F4F1E8]'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        <div className="relative w-full xl:w-72 shrink-0">
          <Search className="w-4 h-4 text-[#A3B5A9] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by claim, citation, or ID..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#14201C] border border-[#26342F] text-xs text-[#F4F1E8] placeholder:text-[#A3B5A9]/60 focus:outline-none focus:border-[#19B887]"
          />
        </div>
      </div>

      {/* Claims Table / Cards List */}
      <div className="space-y-3">
        {filteredClaims.length === 0 ? (
          <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-10 text-center text-sm text-[#A3B5A9]">
            No claims match the current filter criteria.
          </div>
        ) : (
          filteredClaims.map((claim) => {
            const verdictColor = VERDICT_COLORS[claim.verdict];
            const verdictSymbol = VERDICT_SYMBOLS[claim.verdict];
            const nliColor = NLI_COLORS[claim.nli.label];
            const isSelected = selectedClaim?.id === claim.id;

            return (
              <div
                key={claim.id}
                onClick={() => setSelectedClaimId(claim.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedClaimId(claim.id);
                  }
                }}
                className={`rounded-xl border p-5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#19B887] bg-[#16231E]'
                    : 'border-[#25322D] bg-[#1C2623] hover:border-[#374B43]'
                }`}
              >
                {/* Row 1: ID, Section, Citation, Verdict, Confidence (Zero-Pill Unboxed Metadata) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#25322D]">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#A3B5A9]">
                    <span className="font-mono font-semibold text-[#D6B875] tabular-nums">
                      {claim.id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{claim.section}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[#F4F1E8]">
                      Citation: {claim.matchedCitation}
                    </span>
                    {claim.citationFlags.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#F07867] font-medium">
                          Flag: {claim.citationFlags.join(', ')}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span
                      className="font-semibold whitespace-nowrap"
                      style={{ color: verdictColor }}
                    >
                      {verdictSymbol} {claim.verdict}
                    </span>
                    <span className="text-[#A3B5A9] whitespace-nowrap">
                      Confidence: <strong className="text-[#F4F1E8]">{claim.confidenceIndicator}</strong>
                    </span>
                  </div>
                </div>

                {/* Row 2: Exact Claim Statement */}
                <p className="mt-3 text-sm sm:text-base font-medium text-[#F4F1E8] leading-relaxed">
                  “{claim.claimText}”
                </p>

                {/* Row 3: Structured 4-Column Investigation Summary */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3">
                    <p className="text-[#A3B5A9] mb-1">Original Research Paper</p>
                    <p className="text-[#F4F1E8] font-medium line-clamp-2">
                      {claim.source.title ||
                        claim.bibliographyEntry?.rawText ||
                        'No matching publication resolved'}
                    </p>
                    {(claim.source.year || claim.source.fullTextRetrieved) && (
                      <p className="font-mono text-[11px] text-[#D6B875] mt-1 tabular-nums">
                        {claim.source.year || ''}
                        {claim.source.isIllustrativeDemo
                          ? ' · Illustrative Demo Corpus'
                          : claim.source.fullTextRetrieved
                          ? ` · ${claim.source.passageSource}`
                          : claim.source.verified
                          ? ' · OpenAlex / Crossref Verified'
                          : ''}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3">
                    <p className="text-[#A3B5A9] mb-1">Relevant Evidence Passage</p>
                    <p className="text-[#F4F1E8]/90 line-clamp-2 leading-relaxed">
                      {claim.source.relevantPassage ||
                        claim.source.retrievalNote ||
                        'Evidence passage unavailable'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3">
                    <p className="text-[#A3B5A9] mb-1">NLI Classification</p>
                    <p
                      className="font-mono font-semibold"
                      style={{ color: nliColor }}
                    >
                      {claim.nli.label}
                      {claim.nli.confidence !== null
                        ? ` (${Math.round(claim.nli.confidence * 100)}%)`
                        : ''}
                    </p>
                    <p className="text-[#A3B5A9] mt-1 line-clamp-1">
                      {claim.nli.performed
                        ? claim.nli.explanation
                        : 'NLI not performed'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#A3B5A9]">Numerical:</span>
                      <span
                        className="font-mono font-medium"
                        style={{
                          color:
                            claim.numericalCheck.status === 'Mismatch'
                              ? '#E05265'
                              : claim.numericalCheck.status === 'Match'
                              ? '#22C58B'
                              : '#A3B5A9',
                        }}
                      >
                        {claim.numericalCheck.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#A3B5A9]">Context:</span>
                      <span
                        className="font-mono font-medium"
                        style={{
                          color: claim.contextTrap.detected
                            ? '#E9AC45'
                            : claim.contextTrap.status === 'Aligned'
                            ? '#22C58B'
                            : '#A3B5A9',
                        }}
                      >
                        {claim.contextTrap.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#A3B5A9]">Human Review:</span>
                      <span className="font-mono text-[#56B4D3]">
                        {claim.humanReview.decision}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detailed Investigation Slide-Over / Modal Drawer */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-3xl h-full bg-[#101414] border-l border-[#283530] overflow-y-auto p-6 sm:p-8 space-y-6">
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#24312C]">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#A3B5A9]">
                  <span className="font-mono font-semibold text-[#D6B875]">
                    {selectedClaim.id}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className="font-semibold"
                    style={{ color: VERDICT_COLORS[selectedClaim.verdict] }}
                  >
                    {VERDICT_SYMBOLS[selectedClaim.verdict]} {selectedClaim.verdict}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Confidence: {selectedClaim.confidenceIndicator}</span>
                </div>
                <h2 className="font-display text-xl font-semibold text-[#F4F1E8] mt-2 leading-snug">
                  “{selectedClaim.claimText}”
                </h2>
                {selectedClaim.expectedDemoOutcome && (
                  <p className="font-mono text-xs text-[#D6B875] mt-2">
                    Sample Test Case: {selectedClaim.expectedDemoOutcome}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedClaimId(null)}
                className="p-2 rounded-lg border border-[#27342F] text-[#A3B5A9] hover:text-[#F4F1E8] shrink-0 cursor-pointer"
                aria-label="Close investigation panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Automated Verdict Reason */}
            <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-[#19B887]">
                  Automated Verification Synthesis
                </span>
                <button
                  type="button"
                  onClick={() => onInspectEvidence(selectedClaim.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D6B875] hover:underline cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Inspect in Evidence Explorer
                </button>
              </div>
              <p className="text-sm text-[#F4F1E8] leading-relaxed">
                {selectedClaim.reason}
              </p>
              <p className="text-xs text-[#A3B5A9]">
                Uncertainty Note: {selectedClaim.confidenceExplanation}
              </p>
            </div>

            {/* 5-Axis Evidence DNA™ Scorecard */}
            <EvidenceDnaCard dna={selectedClaim.evidenceDna} />

            {/* Natural Language Inference Engine Panel */}
            <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#25322D]">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#F4F1E8]">
                    Natural Language Inference (NLI) Engine
                  </h3>
                  <p className="text-xs text-[#A3B5A9]">
                    Premise-to-hypothesis logical evaluation (beyond semantic similarity)
                  </p>
                </div>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: NLI_COLORS[selectedClaim.nli.label] }}
                >
                  {selectedClaim.nli.label}
                  {selectedClaim.nli.confidence !== null
                    ? ` · ${Math.round(selectedClaim.nli.confidence * 100)}% model confidence`
                    : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-lg border border-[#283530] bg-[#141D1A] p-4">
                  <p className="font-mono text-[11px] text-[#19B887] mb-1.5">
                    PREMISE (Retrieved Source Passage)
                  </p>
                  <p className="text-[#F4F1E8] leading-relaxed">
                    {selectedClaim.nli.premise ||
                      'Unavailable — no source passage could be retrieved.'}
                  </p>
                </div>
                <div className="rounded-lg border border-[#283530] bg-[#141D1A] p-4">
                  <p className="font-mono text-[11px] text-[#D6B875] mb-1.5">
                    HYPOTHESIS (Submitted Claim)
                  </p>
                  <p className="text-[#F4F1E8] leading-relaxed">
                    {selectedClaim.nli.hypothesis}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#A3B5A9] leading-relaxed">
                <strong className="text-[#F4F1E8]">NLI Explanation:</strong>{' '}
                {selectedClaim.nli.explanation}
              </p>
            </div>

            {/* Research Context Trap Detector */}
            <div
              className={`rounded-xl border p-5 space-y-3 ${
                selectedClaim.contextTrap.detected
                  ? 'border-[#E9AC45]/45 bg-[#E9AC45]/6'
                  : 'border-[#25322D] bg-[#1C2623]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    className="w-4 h-4"
                    style={{
                      color: selectedClaim.contextTrap.detected
                        ? '#E9AC45'
                        : '#22C58B',
                    }}
                  />
                  <h3 className="font-display text-base font-semibold text-[#F4F1E8]">
                    Research Context Trap Audit
                  </h3>
                </div>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{
                    color: selectedClaim.contextTrap.detected
                      ? '#E9AC45'
                      : selectedClaim.contextTrap.status === 'Aligned'
                      ? '#22C58B'
                      : '#A3B5A9',
                  }}
                >
                  {selectedClaim.contextTrap.status.toUpperCase()}
                </span>
              </div>

              {selectedClaim.contextTrap.detected && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="rounded-lg border border-[#22C58B]/30 bg-[#141D1A] p-3">
                    <p className="font-mono text-[11px] text-[#22C58B] mb-1">
                      Original Experimental Context
                    </p>
                    <p className="text-[#F4F1E8]">
                      {selectedClaim.contextTrap.originalContext || 'Specified in source abstract'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#E9AC45]/40 bg-[#141D1A] p-3">
                    <p className="font-mono text-[11px] text-[#E9AC45] mb-1">
                      Submitted Claim Context
                    </p>
                    <p className="text-[#F4F1E8]">
                      {selectedClaim.contextTrap.submittedContext || 'Shifted scope in manuscript'}
                    </p>
                  </div>
                </div>
              )}

              {selectedClaim.contextTrap.changedPhrases.length > 0 && (
                <p className="text-xs text-[#E9AC45]">
                  Shifted phrases: {selectedClaim.contextTrap.changedPhrases.join(' · ')}
                </p>
              )}

              <p className="text-xs text-[#A3B5A9] leading-relaxed">
                {selectedClaim.contextTrap.explanation}
              </p>
            </div>

            {/* Number Integrity Checker */}
            <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-[#F4F1E8]">
                  Number Integrity Checker
                </h3>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{
                    color:
                      selectedClaim.numericalCheck.status === 'Mismatch'
                        ? '#E05265'
                        : selectedClaim.numericalCheck.status === 'Match'
                        ? '#22C58B'
                        : '#A3B5A9',
                  }}
                >
                  {selectedClaim.numericalCheck.status.toUpperCase()}
                </span>
              </div>

              {selectedClaim.numericalCheck.hasNumbers && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3">
                    <p className="text-[#A3B5A9] mb-1">Claimed Values</p>
                    <p className="text-[#F4F1E8]">
                      {selectedClaim.numericalCheck.claimedValues.join(', ') || 'None'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3">
                    <p className="text-[#A3B5A9] mb-1">Source Reported Values</p>
                    <p className="text-[#F4F1E8]">
                      {selectedClaim.numericalCheck.reportedValues.join(', ') ||
                        'None found in retrieved passage'}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-[#A3B5A9] leading-relaxed">
                {selectedClaim.numericalCheck.explanation}
              </p>
            </div>

            {/* Source Reference Link */}
            <div className="rounded-xl border border-[#25322D] bg-[#14201C] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <p className="text-[#A3B5A9]">Matched Source Reference</p>
                <p className="text-[#F4F1E8] font-medium mt-0.5">
                  {selectedClaim.source.title ||
                    selectedClaim.bibliographyEntry?.rawText ||
                    'Unresolved reference'}
                </p>
                {selectedClaim.source.doi && (
                  <p className="font-mono text-[#19B887] mt-0.5">
                    DOI: {selectedClaim.source.doi}
                  </p>
                )}
              </div>
              {selectedClaim.source.sourceUrl && !selectedClaim.source.isIllustrativeDemo && (
                <a
                  href={selectedClaim.source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#19B887]/40 text-[#19B887] hover:bg-[#19B887]/10 transition-colors whitespace-nowrap"
                >
                  Open Original Paper
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Human Review Governance System */}
            <div className="rounded-xl border border-[#56B4D3]/35 bg-[#141D1A] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#24312C]">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#56B4D3]" />
                  <h3 className="font-display text-base font-semibold text-[#F4F1E8]">
                    Human Scholarly Review
                  </h3>
                </div>
                <span className="font-mono text-xs text-[#56B4D3]">
                  Decision: {selectedClaim.humanReview.decision}
                </span>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-[#A3B5A9] bg-[#101414] rounded-lg p-3 border border-[#24312C]">
                <AlertTriangle className="w-4 h-4 text-[#D6B875] shrink-0 mt-0.5" />
                <span>
                  Automated verification is an investigative aid and must not be presented as a final academic judgment. Record your independent reviewer decision below.
                </span>
              </div>

              {reviewError && (
                <p className="text-xs text-[#E05265]">{reviewError}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] text-[#A3B5A9] mb-1">
                    Reviewer Name
                  </label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#101414] border border-[#27342F] text-xs text-[#F4F1E8] focus:outline-none focus:border-[#56B4D3]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-[#A3B5A9] mb-1">
                    Reviewer Comments
                  </label>
                  <input
                    type="text"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Add scholarly rationale or context notes..."
                    className="w-full px-3 py-2 rounded-lg bg-[#101414] border border-[#27342F] text-xs text-[#F4F1E8] focus:outline-none focus:border-[#56B4D3]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={savingReview}
                  onClick={() => submitHumanReview('Reviewed')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#56B4D3]/45 bg-[#56B4D3]/10 text-xs font-semibold text-[#56B4D3] hover:bg-[#56B4D3]/20 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark as Reviewed
                </button>
                <button
                  type="button"
                  disabled={savingReview}
                  onClick={() => submitHumanReview('Accepted')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#22C58B]/45 bg-[#22C58B]/10 text-xs font-semibold text-[#22C58B] hover:bg-[#22C58B]/20 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept Automated Finding
                </button>
                <button
                  type="button"
                  disabled={savingReview}
                  onClick={() => submitHumanReview('Rejected')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E05265]/45 bg-[#E05265]/10 text-xs font-semibold text-[#E05265] hover:bg-[#E05265]/20 transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject Automated Finding
                </button>
              </div>

              {selectedClaim.humanReview.history.length > 0 && (
                <div className="pt-3 border-t border-[#24312C] space-y-2">
                  <p className="text-[11px] font-medium text-[#A3B5A9]">
                    Review Audit History
                  </p>
                  {selectedClaim.humanReview.history.map((h) => (
                    <div
                      key={h.id}
                      className="text-xs flex flex-wrap items-baseline justify-between gap-2 py-1 text-[#A3B5A9]"
                    >
                      <span>
                        <strong className="text-[#F4F1E8]">{h.reviewer}</strong> —{' '}
                        {h.action}
                        {h.comment ? `: “${h.comment}”` : ''}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums">
                        {formatShortDate(h.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
