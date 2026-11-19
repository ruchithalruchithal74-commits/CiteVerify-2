import {
  AlertCircle,
  ArrowRight,
  BarChart2,
  BookCheck,
  CheckCircle2,
  FileWarning,
  Flag,
  HelpCircle,
  Scale,
  Upload,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DocumentReport, VerificationVerdict } from '../types.ts';
import { formatShortDate, VERDICT_COLORS } from '../utils/verdicts.ts';

interface AnalysisDashboardPageProps {
  report: DocumentReport | null;
  reports: DocumentReport[];
  onGoUpload: () => void;
  onRunSample: () => void;
  onInspectClaims: (filter?: VerificationVerdict | 'All') => void;
  onSelectReport: (reportId: string) => void;
}

export function AnalysisDashboardPage({
  report,
  reports,
  onGoUpload,
  onRunSample,
  onInspectClaims,
  onSelectReport,
}: AnalysisDashboardPageProps) {
  if (!report) {
    return (
      <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-12 text-center max-w-2xl mx-auto mt-8">
        <Scale className="w-10 h-10 text-[#19B887] mx-auto mb-4" />
        <h2 className="font-display text-2xl font-semibold text-[#F4F1E8]">
          No manuscript analyzed yet
        </h2>
        <p className="text-sm text-[#A3B5A9] mt-2 leading-relaxed">
          Upload a PDF, scanned PDF, TXT, or figure image to populate live verification analytics, or run the 7-case Sample Demonstration manuscript.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onGoUpload}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#19B887] text-[#0B1411] text-sm font-semibold hover:bg-[#1FD099] transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload Research Paper
          </button>
          <button
            type="button"
            onClick={onRunSample}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#D6B875]/45 bg-[#14201C] text-sm font-semibold text-[#F4F1E8] hover:border-[#D6B875] transition-colors cursor-pointer"
          >
            Try Sample Paper
          </button>
        </div>
      </div>
    );
  }

  const s = report.summaryStats;
  const figures = report.figuresAnalyzed || [];

  const statCards: Array<{
    label: string;
    value: number;
    accent: string;
    icon: typeof CheckCircle2;
    filter?: VerificationVerdict | 'All';
  }> = [
    {
      label: 'Total Claims Detected',
      value: s.totalClaims,
      accent: '#F4F1E8',
      icon: Scale,
      filter: 'All',
    },
    {
      label: 'Citations Found',
      value: s.citationsFound,
      accent: '#D6B875',
      icon: BookCheck,
    },
    {
      label: 'Verified Sources',
      value: s.verifiedSources,
      accent: '#19B887',
      icon: CheckCircle2,
    },
    {
      label: 'Unsupported Claims',
      value: s.unsupportedClaims,
      accent: VERDICT_COLORS.Unsupported,
      icon: HelpCircle,
      filter: 'Unsupported',
    },
    {
      label: 'Contradictory Claims',
      value: s.contradictoryClaims,
      accent: VERDICT_COLORS.Contradictory,
      icon: AlertCircle,
      filter: 'Contradictory',
    },
    {
      label: 'Claims Needing Review',
      value: s.claimsNeedingReview,
      accent: VERDICT_COLORS['Human Review'],
      icon: Flag,
      filter: 'Human Review',
    },
  ];

  const distributionData = (
    [
      { name: 'Supported', value: s.supportedClaims, color: VERDICT_COLORS.Supported },
      {
        name: 'Partially Supported',
        value: s.partiallySupportedClaims,
        color: VERDICT_COLORS['Partially Supported'],
      },
      { name: 'Unsupported', value: s.unsupportedClaims, color: VERDICT_COLORS.Unsupported },
      { name: 'Contradictory', value: s.contradictoryClaims, color: VERDICT_COLORS.Contradictory },
      {
        name: 'Potentially Outdated',
        value: s.potentiallyOutdatedClaims,
        color: VERDICT_COLORS['Potentially Outdated'],
      },
      {
        name: 'Human Review',
        value: report.claims.filter((c) => c.verdict === 'Human Review').length,
        color: VERDICT_COLORS['Human Review'],
      },
    ] as Array<{ name: VerificationVerdict; value: number; color: string }>
  ).filter((d) => d.value > 0);

  const citationQualityCounts = [
    {
      label: 'Verified Publications',
      count: report.citationAudit.filter((c) => c.verified).length,
      color: '#22C58B',
    },
    {
      label: 'Open-Access Full-Text Sources',
      count: s.fullTextSources || 0,
      color: '#19B887',
    },
    {
      label: 'Missing Citations',
      count: report.claims.filter((c) => c.citationFlags.includes('Missing Citation')).length,
      color: '#F07867',
    },
    {
      label: 'Missing / Unresolved Publication',
      count: report.citationAudit.filter(
        (c) =>
          c.flags.includes('Missing Publication') || c.flags.includes('Incorrect DOI')
      ).length,
      color: '#E05265',
    },
    {
      label: 'Author or Year Mismatch',
      count: report.citationAudit.filter(
        (c) => c.flags.includes('Author Mismatch') || c.flags.includes('Year Mismatch')
      ).length,
      color: '#E9AC45',
    },
    {
      label: 'Duplicate Bibliography Entries',
      count: report.bibliographyEntries.filter((b) => b.isDuplicate).length,
      color: '#A78BFA',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F1E8]">
            Analysis Dashboard
          </h1>
          <p className="text-sm text-[#A3B5A9] mt-1">
            Live empirical audit for <span className="text-[#F4F1E8]">{report.filename}</span> · Report{' '}
            <span className="font-mono text-[#D6B875]">{report.reportId}</span> · Auditor{' '}
            <span className="text-[#F4F1E8]">{report.userDisplayName}</span> · {report.extractionMethod}
            {report.ocrUsed ? ' (OCR)' : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onInspectClaims('All')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#19B887]/15 border border-[#19B887]/40 text-xs font-semibold text-[#19B887] hover:bg-[#19B887]/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Investigate All {s.totalClaims} Claims
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {report.isSampleDemo && (
        <div className="rounded-xl border border-[#D6B875]/40 bg-[#D6B875]/8 px-4 py-3 text-xs text-[#F4F1E8] flex items-start gap-3">
          <FileWarning className="w-4 h-4 text-[#D6B875] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#D6B875]">
              Sample Demonstration Mode:
            </span>{' '}
            Genuine references ([1], [2], [5]) were queried live via OpenAlex, Crossref, Unpaywall & Europe PMC, while CV-DEMO-03, CV-DEMO-04, and CV-DEMO-06 use clearly labeled illustrative synthetic corpus excerpts for controlled edge-case testing.
          </div>
        </div>
      )}

      {report.pipelineWarnings.length > 0 && (
        <div className="rounded-xl border border-[#E9AC45]/35 bg-[#E9AC45]/8 px-4 py-3 text-xs text-[#F4F1E8] space-y-1">
          <p className="font-semibold text-[#E9AC45]">Pipeline Notices</p>
          {report.pipelineWarnings.map((w, i) => (
            <p key={i} className="text-[#A3B5A9]">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* 6 Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const clickable = Boolean(card.filter);
          return (
            <div
              key={card.label}
              onClick={() => card.filter && onInspectClaims(card.filter)}
              className={`rounded-xl border border-[#25322D] bg-[#1C2623] p-4 flex flex-col justify-between ${
                clickable ? 'hover:border-[#19B887]/50 cursor-pointer transition-colors' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#A3B5A9] leading-snug">
                  {card.label}
                </span>
                <Icon className="w-4 h-4 shrink-0" style={{ color: card.accent }} />
              </div>
              <p
                className="mt-3 font-mono text-2xl font-semibold tabular-nums"
                style={{ color: card.accent }}
              >
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts Row: Donut + Claim Status Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
          <h2 className="font-display text-lg font-semibold text-[#F4F1E8]">
            Verification Distribution
          </h2>
          <p className="text-xs text-[#A3B5A9] mt-0.5 mb-4">
            Breakdown of final verdicts across extracted scientific claims
          </p>

          {distributionData.length > 0 ? (
            <div className="h-[250px] flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={3}
                      stroke="#101414"
                      strokeWidth={2}
                    >
                      {distributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101414',
                        borderColor: '#2A3732',
                        borderRadius: '8px',
                        color: '#F4F1E8',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 space-y-2 text-xs">
                {distributionData.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => onInspectClaims(d.name)}
                    className="w-full flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-[#14201C] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-[#F4F1E8] truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="font-mono tabular-nums text-[#A3B5A9]">
                      {d.value}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#A3B5A9] py-16 text-center">
              No claims extracted for distribution chart.
            </p>
          )}
        </div>

        <div className="lg:col-span-7 rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
          <h2 className="font-display text-lg font-semibold text-[#F4F1E8]">
            Claim Status Breakdown
          </h2>
          <p className="text-xs text-[#A3B5A9] mt-0.5 mb-4">
            Claim counts by verification outcome, numerical mismatches ({s.numericalMismatches}), context traps ({s.contextTrapsDetected}), and OA full-text matches ({s.fullTextSources || 0})
          </p>

          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributionData}
                margin={{ top: 8, right: 16, left: -16, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#24312C" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#A3B5A9', fontSize: 11 }}
                  axisLine={{ stroke: '#2A3732' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#A3B5A9', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(25, 184, 135, 0.06)' }}
                  contentStyle={{
                    backgroundColor: '#101414',
                    borderColor: '#2A3732',
                    borderRadius: '8px',
                    color: '#F4F1E8',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {distributionData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Multimodal Figures & Graphs Vision Analysis (shown whenever figures/charts detected) */}
      {figures.length > 0 && (
        <section className="rounded-xl border border-[#25322D] bg-[#1C2623] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#25322D]">
            <div className="flex items-center gap-2.5">
              <BarChart2 className="w-5 h-5 text-[#19B887]" />
              <div>
                <h2 className="font-display text-lg font-semibold text-[#F4F1E8]">
                  Figures & Graphs Vision Analysis
                </h2>
                <p className="text-xs text-[#A3B5A9]">
                  Multimodal inspection of charts, plots, axes, and numerical consistency against manuscript prose
                </p>
              </div>
            </div>
            <span className="font-mono text-xs text-[#D6B875] tabular-nums">
              {figures.length} visual figure{figures.length === 1 ? '' : 's'} analyzed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {figures.map((fig) => {
              const statusColor =
                fig.claimAlignmentStatus === 'Discrepancy Detected'
                  ? '#E05265'
                  : fig.claimAlignmentStatus === 'Aligned'
                  ? '#22C58B'
                  : '#D6B875';

              return (
                <div
                  key={fig.figureId}
                  className="rounded-lg border border-[#283530] bg-[#141D1A] p-4 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-semibold text-[#D6B875]">{fig.figureId}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#A3B5A9]">{fig.chartType}</span>
                    </div>
                    <span className="font-mono font-semibold" style={{ color: statusColor }}>
                      {fig.claimAlignmentStatus}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-[#F4F1E8]">{fig.title}</p>
                  <p className="text-[#A3B5A9]">
                    <strong className="text-[#F4F1E8]">Axes & Units:</strong> {fig.axesAndUnits}
                  </p>
                  <p className="text-[#F4F1E8]/90 leading-relaxed">{fig.keyFinding}</p>

                  {fig.extractedValues.length > 0 && (
                    <p className="font-mono text-[11px] text-[#19B887]">
                      Extracted Values: {fig.extractedValues.join(' · ')}
                    </p>
                  )}

                  {fig.claimAlignmentNote && (
                    <p className="text-[#A3B5A9] pt-2 border-t border-[#22302B]">
                      {fig.claimAlignmentNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Bottom Row: Citation Quality + Research Source Timeline + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
          <h2 className="font-display text-lg font-semibold text-[#F4F1E8]">
            Citation Quality Overview
          </h2>
          <p className="text-xs text-[#A3B5A9] mt-0.5 mb-4">
            Bibliographic audit across {report.bibliographyEntries.length} references
          </p>
          <div className="space-y-3">
            {citationQualityCounts.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 py-2 border-b border-[#25322D] last:border-b-0 text-xs"
              >
                <span className="text-[#F4F1E8]">{item.label}</span>
                <span
                  className="font-mono font-semibold tabular-nums"
                  style={{ color: item.color }}
                >
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
          <h2 className="font-display text-lg font-semibold text-[#F4F1E8]">
            Research Source Timeline
          </h2>
          <p className="text-xs text-[#A3B5A9] mt-0.5 mb-4">
            Publication year distribution of cited literature
          </p>
          {report.timelineData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.timelineData}
                  margin={{ top: 8, right: 8, left: -20, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#24312C" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: '#A3B5A9', fontSize: 11 }}
                    axisLine={{ stroke: '#2A3732' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#A3B5A9', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#101414',
                      borderColor: '#2A3732',
                      borderRadius: '8px',
                      color: '#F4F1E8',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="sources"
                    name="Cited Works"
                    fill="#D6B875"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="verified"
                    name="Verified Works"
                    fill="#19B887"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-[#A3B5A9] py-16 text-center">
              No publication years detected in citations.
            </p>
          )}
        </div>

        <div className="lg:col-span-4 rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
          <h2 className="font-display text-lg font-semibold text-[#F4F1E8]">
            Recent Verification Activity
          </h2>
          <p className="text-xs text-[#A3B5A9] mt-0.5 mb-4">
            SQLite-persisted multi-user audit history
          </p>
          <div className="space-y-3">
            {reports.slice(0, 4).map((r) => (
              <button
                key={r.reportId}
                type="button"
                onClick={() => onSelectReport(r.reportId)}
                className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                  r.reportId === report.reportId
                    ? 'border-[#19B887]/45 bg-[#14201C]'
                    : 'border-[#25322D] bg-[#141D1A] hover:border-[#34463F]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#F4F1E8] truncate">
                    {r.filename}
                  </p>
                  <span className="font-mono text-[11px] text-[#D6B875] shrink-0">
                    {r.fileType}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-[#A3B5A9] mt-1 tabular-nums">
                  {r.summaryStats.totalClaims} claims · {r.userDisplayName} · {formatShortDate(r.uploadedAt)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
