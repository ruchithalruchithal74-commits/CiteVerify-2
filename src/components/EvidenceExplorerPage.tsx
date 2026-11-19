import {
  AlertCircle,
  BookOpenCheck,
  ExternalLink,
  FlaskConical,
  Loader2,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ClaimAnalysis, DocumentReport, ResearchSourceRecord } from '../types.ts';

interface EvidenceExplorerPageProps {
  report: DocumentReport | null;
  focusedClaimId: string | null;
  onGoUpload: () => void;
}

function HighlightedAbstract({
  fullText,
  highlightPassage,
}: {
  fullText: string;
  highlightPassage?: string;
}) {
  if (!highlightPassage || highlightPassage.length < 15) {
    return <p className="text-sm text-[#F4F1E8]/90 leading-relaxed">{fullText}</p>;
  }

  const idx = fullText
    .toLowerCase()
    .indexOf(highlightPassage.slice(0, 40).toLowerCase());
  if (idx === -1) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[#19B887]/40 bg-[#19B887]/10 p-3.5">
          <p className="font-mono text-[11px] text-[#19B887] mb-1">
            Highlighted Relevant Passage
          </p>
          <p className="text-sm text-[#F4F1E8] leading-relaxed">
            {highlightPassage}
          </p>
        </div>
        <p className="text-sm text-[#A3B5A9] leading-relaxed">{fullText}</p>
      </div>
    );
  }

  const end = Math.min(fullText.length, idx + highlightPassage.length);
  const before = fullText.slice(0, idx);
  const match = fullText.slice(idx, end);
  const after = fullText.slice(end);

  return (
    <p className="text-sm text-[#A3B5A9] leading-relaxed">
      {before}
      <mark className="bg-[#19B887]/20 text-[#F4F1E8] px-1 py-0.5 rounded border border-[#19B887]/35">
        {match}
      </mark>
      {after}
    </p>
  );
}

export function EvidenceExplorerPage({
  report,
  focusedClaimId,
  onGoUpload,
}: EvidenceExplorerPageProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(
    focusedClaimId
  );

  // Live ad-hoc OpenAlex/Crossref query state
  const [lookupInput, setLookupInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [adHocSource, setAdHocSource] = useState<ResearchSourceRecord | null>(
    null
  );

  useEffect(() => {
    if (focusedClaimId) {
      setSelectedClaimId(focusedClaimId);
      setAdHocSource(null);
    } else if (report && report.claims.length > 0 && !selectedClaimId) {
      setSelectedClaimId(report.claims[0].id);
    }
  }, [focusedClaimId, report]);

  const activeClaim: ClaimAnalysis | null = useMemo(() => {
    if (!report || !selectedClaimId) return null;
    return report.claims.find((c) => c.id === selectedClaimId) || null;
  }, [report, selectedClaimId]);

  const handleLiveLookup = async (e: FormEvent) => {
    e.preventDefault();
    const q = lookupInput.trim();
    if (!q) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const isDoi = /^10\.\d{4,9}\//.test(q) || q.includes('doi.org/');
      const res = await fetch('/api/sources/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isDoi ? { doi: q } : { title: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed.');
      setAdHocSource(data.source);
    } catch (err: any) {
      setLookupError(err?.message || 'Unable to query OpenAlex and Crossref.');
    } finally {
      setLookupLoading(false);
    }
  };

  const displayedSource: ResearchSourceRecord | null =
    adHocSource || activeClaim?.source || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F1E8]">
            Evidence Explorer
          </h1>
          <p className="text-sm text-[#A3B5A9] mt-1">
            Inspect primary publication metadata, retrieved abstracts, experimental boundaries, and direct source links from OpenAlex and Crossref.
          </p>
        </div>

        {/* Live DOI / Title Query Bar */}
        <form onSubmit={handleLiveLookup} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 text-[#A3B5A9] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Live lookup: paste DOI (e.g. 10.1038/...) or title"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#14201C] border border-[#27342F] text-xs text-[#F4F1E8] placeholder:text-[#A3B5A9]/60 focus:outline-none focus:border-[#19B887]"
            />
          </div>
          <button
            type="submit"
            disabled={lookupLoading}
            className="px-4 py-2 rounded-lg bg-[#19B887] text-[#0B1411] text-xs font-semibold hover:bg-[#1FD099] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            {lookupLoading ? 'Querying...' : 'Query APIs'}
          </button>
        </form>
      </div>

      {lookupError && (
        <div className="rounded-xl border border-[#E05265]/40 bg-[#E05265]/10 p-3.5 text-xs text-[#E05265]">
          {lookupError}
        </div>
      )}

      {!report && !adHocSource ? (
        <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-12 text-center max-w-2xl mx-auto mt-8">
          <BookOpenCheck className="w-10 h-10 text-[#19B887] mx-auto mb-4" />
          <h2 className="font-display text-2xl font-semibold text-[#F4F1E8]">
            No manuscript sources loaded
          </h2>
          <p className="text-sm text-[#A3B5A9] mt-2">
            Upload a research paper above, or paste any DOI / title in the live OpenAlex & Crossref lookup bar.
          </p>
          <button
            type="button"
            onClick={onGoUpload}
            className="mt-6 px-5 py-2.5 rounded-lg bg-[#19B887] text-[#0B1411] text-sm font-semibold hover:bg-[#1FD099] transition-colors cursor-pointer"
          >
            Go to Document Upload
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Source List */}
          {report && (
            <div className="lg:col-span-4 rounded-xl border border-[#25322D] bg-[#1C2623] p-4 space-y-2 max-h-[760px] overflow-y-auto">
              <p className="font-mono text-xs text-[#D6B875] px-2 pb-2 border-b border-[#25322D]">
                Cited Sources in Manuscript ({report.claims.length})
              </p>
              {report.claims.map((c) => {
                const selected = !adHocSource && activeClaim?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setAdHocSource(null);
                      setSelectedClaimId(c.id);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#19B887] bg-[#14201C]'
                        : 'border-transparent hover:bg-[#141D1A]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-[#D6B875]">{c.id} · {c.matchedCitation}</span>
                      <span
                        className={
                          c.source.verified ? 'text-[#22C58B]' : 'text-[#F07867]'
                        }
                      >
                        {c.source.isIllustrativeDemo
                          ? 'Demo Corpus'
                          : c.source.verified
                          ? 'Verified'
                          : 'Unresolved'}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#F4F1E8] mt-1 line-clamp-2">
                      {c.source.title ||
                        c.bibliographyEntry?.rawText ||
                        'Unreferenced or unresolved citation'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Right Detailed Evidence View */}
          <div
            className={`${
              report ? 'lg:col-span-8' : 'lg:col-span-12'
            } rounded-xl border border-[#25322D] bg-[#1C2623] p-6 sm:p-7 space-y-6`}
          >
            {lookupLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-xs text-[#A3B5A9]">
                <Loader2 className="w-6 h-6 text-[#19B887] animate-spin mb-3" />
                Querying OpenAlex & Crossref live APIs...
              </div>
            ) : !displayedSource ? (
              <p className="text-sm text-[#A3B5A9] py-12 text-center">
                Select a citation to inspect its primary evidence record.
              </p>
            ) : (
              <>
                {displayedSource.isIllustrativeDemo && (
                  <div className="rounded-lg border border-[#D6B875]/45 bg-[#D6B875]/10 p-3.5 flex items-start gap-2.5 text-xs">
                    <FlaskConical className="w-4 h-4 text-[#D6B875] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[#D6B875]">
                        Illustrative Synthetic Demonstration Corpus:
                      </span>{' '}
                      <span className="text-[#F4F1E8]">
                        This source passage is an illustrative test fixture labeled clearly for demonstration purposes and is not a genuine external publication.
                      </span>
                    </div>
                  </div>
                )}

                {adHocSource && (
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[#25322D]">
                    <span className="font-mono text-[#19B887]">
                      Live API Lookup Result
                    </span>
                    {report && (
                      <button
                        type="button"
                        onClick={() => setAdHocSource(null)}
                        className="text-[#A3B5A9] hover:text-[#F4F1E8] underline cursor-pointer"
                      >
                        Return to manuscript source
                      </button>
                    )}
                  </div>
                )}

                {/* Title & Action */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#25322D]">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span
                        className={
                          displayedSource.verified ? 'text-[#22C58B]' : 'text-[#E05265]'
                        }
                      >
                        {displayedSource.verified
                          ? '✓ Source Record Confirmed'
                          : '✕ Publication Not Resolved'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#A3B5A9]">
                        OpenAlex: {displayedSource.openAlexFound ? 'Match' : 'No'} / Crossref:{' '}
                        {displayedSource.crossrefFound ? 'Match' : 'No'} / Unpaywall:{' '}
                        {displayedSource.unpaywallFound ? 'OA' : 'No'}
                      </span>
                      {displayedSource.fullTextRetrieved && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#19B887] font-semibold">
                            OA Full Text Retrieved
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#F4F1E8] leading-snug">
                      {displayedSource.title || 'Publication Title Unavailable'}
                    </h2>
                  </div>

                  {displayedSource.sourceUrl && !displayedSource.isIllustrativeDemo && (
                    <a
                      href={displayedSource.openAccessUrl || displayedSource.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#19B887] text-[#0B1411] text-xs font-semibold hover:bg-[#1FD099] transition-colors whitespace-nowrap shrink-0"
                    >
                      {displayedSource.openAccessUrl
                        ? 'Open Full Text (OA)'
                        : 'Open Original Publication'}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Metadata Grid */}
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3.5">
                    <dt className="text-[#A3B5A9] mb-1">Authors</dt>
                    <dd className="text-[#F4F1E8] font-medium">
                      {displayedSource.authors.length > 0
                        ? displayedSource.authors.slice(0, 6).join(', ') +
                          (displayedSource.authors.length > 6 ? ' et al.' : '')
                        : 'Unavailable'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3.5">
                    <dt className="text-[#A3B5A9] mb-1">Journal / Venue</dt>
                    <dd className="text-[#F4F1E8] font-medium">
                      {displayedSource.journal || 'Unavailable'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3.5">
                    <dt className="text-[#A3B5A9] mb-1">Publication Year</dt>
                    <dd className="font-mono text-[#D6B875] tabular-nums">
                      {displayedSource.year || 'Unavailable'}
                      {typeof displayedSource.citedByCount === 'number'
                        ? ` · ${displayedSource.citedByCount.toLocaleString()} citations`
                        : ''}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3.5">
                    <dt className="text-[#A3B5A9] mb-1">DOI</dt>
                    <dd className="font-mono text-[#19B887] break-all">
                      {displayedSource.doi || 'Unavailable'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-3.5 sm:col-span-2">
                    <dt className="text-[#A3B5A9] mb-1">OpenAlex ID</dt>
                    <dd className="font-mono text-[#F4F1E8] break-all">
                      {displayedSource.openAlexId || 'Unavailable'}
                    </dd>
                  </div>
                </dl>

                {/* Relevant Research Passage */}
                <div className="rounded-xl border border-[#283530] bg-[#141D1A] p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-[#F4F1E8]">
                      Retrieved Research Evidence Passage
                    </h3>
                    <span className="font-mono text-xs text-[#D6B875]">
                      Source: {displayedSource.passageSource}
                    </span>
                  </div>

                  {displayedSource.abstractText ? (
                    <HighlightedAbstract
                      fullText={displayedSource.abstractText}
                      highlightPassage={displayedSource.relevantPassage}
                    />
                  ) : displayedSource.relevantPassage ? (
                    <p className="text-sm text-[#F4F1E8]/90 leading-relaxed">
                      {displayedSource.relevantPassage}
                    </p>
                  ) : (
                    <div className="flex items-start gap-3 py-4 text-xs text-[#F07867]">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">
                          Evidence Passage Unavailable
                        </p>
                        <p className="text-[#A3B5A9] mt-1">
                          {displayedSource.retrievalNote ||
                            'Neither OpenAlex, Crossref, Unpaywall, nor Europe PMC exposed an open abstract or full text for this publication. CiteVerify never fabricates source passages or page numbers.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {displayedSource.fullTextChunksUsed &&
                    displayedSource.fullTextChunksUsed.length > 0 && (
                      <div className="pt-4 mt-3 border-t border-[#24312C] space-y-2.5">
                        <p className="font-mono text-[11px] text-[#19B887]">
                          Semantic Full-Text Excerpts Retrieved Beyond Abstract ({displayedSource.fullTextChunksUsed.length})
                        </p>
                        {displayedSource.fullTextChunksUsed.map((chunk, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-[#24312C] bg-[#101414] p-3 text-xs text-[#A3B5A9] leading-relaxed"
                          >
                            {chunk}
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {/* Findings, Limitations, Experimental Conditions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-4">
                    <h4 className="font-mono text-[11px] text-[#19B887] mb-1.5">
                      Reported Findings
                    </h4>
                    <p className="text-[#F4F1E8]/90 leading-relaxed">
                      {displayedSource.findings ||
                        (displayedSource.abstractText
                          ? 'See retrieved abstract above.'
                          : 'Unavailable without retrieved passage.')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-4">
                    <h4 className="font-mono text-[11px] text-[#E9AC45] mb-1.5">
                      Experimental Conditions
                    </h4>
                    <p className="text-[#F4F1E8]/90 leading-relaxed">
                      {displayedSource.experimentalConditions ||
                        'Not specified in retrieved record.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#24312C] bg-[#141D1A] p-4">
                    <h4 className="font-mono text-[11px] text-[#F07867] mb-1.5">
                      Limitations & Scope
                    </h4>
                    <p className="text-[#F4F1E8]/90 leading-relaxed">
                      {displayedSource.limitations ||
                        'Not explicitly stated in retrieved abstract.'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
