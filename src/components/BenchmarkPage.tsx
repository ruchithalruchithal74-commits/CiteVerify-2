import {
  CheckCircle2,
  Gauge,
  Loader2,
  Play,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  BenchmarkCategory,
  BenchmarkRunSummary,
  WorkspaceUser,
} from '../types.ts';
import { formatShortDate } from '../utils/verdicts.ts';

interface BenchmarkPageProps {
  activeUser: WorkspaceUser;
}

const CATEGORIES: BenchmarkCategory[] = [
  'Supported',
  'Numeric-Drift',
  'Contradicted',
  'Fabricated',
];

const CATEGORY_COLORS: Record<BenchmarkCategory, string> = {
  Supported: '#22C58B',
  'Numeric-Drift': '#E9AC45',
  Contradicted: '#E05265',
  Fabricated: '#F07867',
};

export function BenchmarkPage({ activeUser }: BenchmarkPageProps) {
  const [runs, setRuns] = useState<BenchmarkRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [datasetSize, setDatasetSize] = useState(36);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<
    BenchmarkCategory | 'All' | 'Errors'
  >('All');

  useEffect(() => {
    fetch('/api/benchmark/history')
      .then((res) => (res.ok ? res.json() : { runs: [], datasetSize: 36 }))
      .then((data) => {
        if (Array.isArray(data.runs)) {
          setRuns(data.runs);
          if (data.runs.length > 0) setSelectedRunId(data.runs[0].runId);
        }
        if (typeof data.datasetSize === 'number') {
          setDatasetSize(data.datasetSize);
        }
      })
      .catch(() => {
        // Ignore initial history failure
      })
      .finally(() => setLoadingHistory(false));
  }, []);

  const handleRunBenchmark = async () => {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch('/api/benchmark/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Benchmark evaluation failed.');
      const nextRun = data.run as BenchmarkRunSummary;
      setRuns((prev) => [nextRun, ...prev]);
      setSelectedRunId(nextRun.runId);
    } catch (err: any) {
      setError(err?.message || 'Unable to complete automated benchmark run.');
    } finally {
      setRunning(false);
    }
  };

  const activeRun =
    runs.find((r) => r.runId === selectedRunId) || runs[0] || null;

  const filteredItems = activeRun
    ? activeRun.items.filter((item) => {
        if (categoryFilter === 'All') return true;
        if (categoryFilter === 'Errors') return !item.correct;
        return item.expectedCategory === categoryFilter;
      })
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F1E8]">
            Automated NLI Evaluation Benchmark
          </h1>
          <p className="text-sm text-[#A3B5A9] mt-1 max-w-2xl">
            Golden evaluation suite of <span className="font-mono text-[#D6B875]">{datasetSize}</span> labeled scientific claims across Supported, Numeric-Drift, Contradicted, and Fabricated classes to measure live Precision, Recall, and F1.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunBenchmark}
          disabled={running}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#19B887] text-[#0B1411] text-xs font-semibold hover:bg-[#1FD099] transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Evaluating {datasetSize} Claims...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Benchmark Evaluation
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-[#E05265]/40 bg-[#E05265]/10 px-4 py-3 text-xs text-[#E05265]">
          {error}
        </div>
      )}

      {loadingHistory ? (
        <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-12 text-center text-xs text-[#A3B5A9]">
          <Loader2 className="w-5 h-5 text-[#19B887] animate-spin mx-auto mb-3" />
          Loading persisted benchmark history...
        </div>
      ) : !activeRun ? (
        <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-12 text-center max-w-2xl mx-auto">
          <Gauge className="w-10 h-10 text-[#19B887] mx-auto mb-4" />
          <h2 className="font-display text-2xl font-semibold text-[#F4F1E8]">
            Ready to Evaluate Verification Accuracy
          </h2>
          <p className="text-sm text-[#A3B5A9] mt-2 leading-relaxed">
            Run CiteVerify’s live numerical integrity checker, citation authenticity checks, and NLI engine against the {datasetSize}-claim golden benchmark dataset to compute real Precision, Recall, F1, and Confusion Matrix metrics.
          </p>
          <button
            type="button"
            onClick={handleRunBenchmark}
            disabled={running}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#19B887] text-[#0B1411] text-sm font-semibold hover:bg-[#1FD099] transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Run {datasetSize}-Claim Golden Benchmark
          </button>
        </div>
      ) : (
        <>
          {/* Run Selector + KPI Cards */}
          {runs.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#25322D] bg-[#14201C] px-4 py-3 text-xs">
              <span className="text-[#A3B5A9]">
                Showing Benchmark Run{' '}
                <strong className="font-mono text-[#D6B875]">{activeRun.runId}</strong> ·{' '}
                {formatShortDate(activeRun.ranAt)} · {(activeRun.durationMs / 1000).toFixed(1)}s
              </span>
              <select
                value={activeRun.runId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#101414] border border-[#283631] text-xs font-mono text-[#F4F1E8]"
              >
                {runs.map((r) => (
                  <option key={r.runId} value={r.runId}>
                    {r.runId} — {(r.overallAccuracy * 100).toFixed(1)}% Acc ({formatShortDate(r.ranAt)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-5">
              <p className="text-xs text-[#A3B5A9]">Overall Accuracy</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-[#19B887] tabular-nums">
                {(activeRun.overallAccuracy * 100).toFixed(1)}%
              </p>
              <p className="font-mono text-[11px] text-[#A3B5A9] mt-1 tabular-nums">
                {activeRun.correctItems} / {activeRun.totalItems} claims exact match
              </p>
            </div>
            <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-5">
              <p className="text-xs text-[#A3B5A9]">Macro Precision</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-[#D6B875] tabular-nums">
                {(activeRun.macroPrecision * 100).toFixed(1)}%
              </p>
              <p className="text-[11px] text-[#A3B5A9] mt-1">
                Mean across 4 verification classes
              </p>
            </div>
            <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-5">
              <p className="text-xs text-[#A3B5A9]">Macro Recall</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-[#22C58B] tabular-nums">
                {(activeRun.macroRecall * 100).toFixed(1)}%
              </p>
              <p className="text-[11px] text-[#A3B5A9] mt-1">
                Sensitivity across edge cases
              </p>
            </div>
            <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-5">
              <p className="text-xs text-[#A3B5A9]">Macro F1 Score</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-[#F4F1E8] tabular-nums">
                {(activeRun.macroF1 * 100).toFixed(1)}%
              </p>
              <p className="font-mono text-[11px] text-[#A3B5A9] mt-1 tabular-nums">
                Runtime: {(activeRun.durationMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          {/* Per-Class Precision/Recall/F1 + 4x4 Confusion Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
              <h2 className="font-display text-lg font-semibold text-[#F4F1E8]">
                Per-Class Precision, Recall & F1
              </h2>
              <p className="text-xs text-[#A3B5A9] mt-0.5 mb-4">
                Balanced evaluation across 9 claims per category
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#25322D] text-[#A3B5A9] font-mono">
                      <th className="py-2 pr-3">Class</th>
                      <th className="py-2 px-2 text-right">TP / Total</th>
                      <th className="py-2 px-2 text-right">Precision</th>
                      <th className="py-2 px-2 text-right">Recall</th>
                      <th className="py-2 pl-2 text-right">F1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRun.classMetrics.map((m) => (
                      <tr
                        key={m.category}
                        className="border-b border-[#24312C] last:border-b-0"
                      >
                        <td
                          className="py-3 pr-3 font-semibold"
                          style={{ color: CATEGORY_COLORS[m.category] }}
                        >
                          {m.category}
                        </td>
                        <td className="py-3 px-2 text-right font-mono tabular-nums text-[#A3B5A9]">
                          {m.truePositive}/{m.total}
                        </td>
                        <td className="py-3 px-2 text-right font-mono tabular-nums text-[#F4F1E8]">
                          {(m.precision * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-2 text-right font-mono tabular-nums text-[#F4F1E8]">
                          {(m.recall * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 pl-2 text-right font-mono font-semibold tabular-nums text-[#19B887]">
                          {(m.f1 * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
              <h2 className="font-display text-lg font-semibold text-[#F4F1E8]">
                4×4 Confusion Matrix
              </h2>
              <p className="text-xs text-[#A3B5A9] mt-0.5 mb-4">
                Rows = Ground Truth · Columns = CiteVerify Prediction
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-[#A3B5A9] border-b border-[#25322D]">
                      <th className="py-2 pr-2 text-left">Actual \ Pred</th>
                      {CATEGORIES.map((c) => (
                        <th key={c} className="py-2 px-2 text-center">
                          {c.replace('Numeric-Drift', 'Num-Drift')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.map((actual) => (
                      <tr key={actual} className="border-b border-[#24312C] last:border-b-0">
                        <td
                          className="py-2.5 pr-2 font-sans font-semibold"
                          style={{ color: CATEGORY_COLORS[actual] }}
                        >
                          {actual}
                        </td>
                        {CATEGORIES.map((pred) => {
                          const count = activeRun.confusionMatrix[actual]?.[pred] || 0;
                          const isDiag = actual === pred;
                          return (
                            <td key={pred} className="py-2 px-2 text-center tabular-nums">
                              <span
                                className={`inline-block min-w-[32px] py-1 rounded ${
                                  isDiag
                                    ? 'bg-[#19B887]/20 text-[#22C58B] font-semibold'
                                    : count > 0
                                    ? 'bg-[#E05265]/20 text-[#E05265] font-semibold'
                                    : 'text-[#A3B5A9]/40'
                                }`}
                              >
                                {count}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Item-level Inspection Ledger */}
          <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#F4F1E8]">
                  Item-Level Benchmark Predictions ({filteredItems.length})
                </h2>
                <p className="text-xs text-[#A3B5A9]">
                  Compare expected ground truth against CiteVerify live classification
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#14201C] border border-[#24322D]">
                {(['All', 'Errors', ...CATEGORIES] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setCategoryFilter(opt)}
                    className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                      categoryFilter === opt
                        ? 'bg-[#19B887] text-[#0B1411] font-semibold'
                        : 'text-[#A3B5A9] hover:text-[#F4F1E8]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#25322D] bg-[#141D1A] p-4 text-xs space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 font-mono">
                      <span className="text-[#D6B875] font-semibold">{item.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans text-[#A3B5A9]">{item.domain}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#A3B5A9]">NLI: {item.nliLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#A3B5A9]">Num: {item.numericalStatus}</span>
                    </div>

                    <div className="flex items-center gap-3 font-mono">
                      <span style={{ color: CATEGORY_COLORS[item.expectedCategory] }}>
                        Expected: {item.expectedCategory}
                      </span>
                      <span aria-hidden="true">→</span>
                      <span
                        className="inline-flex items-center gap-1 font-semibold"
                        style={{ color: item.correct ? '#22C58B' : '#E05265' }}
                      >
                        {item.correct ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {item.predictedCategory}
                      </span>
                    </div>
                  </div>

                  <p className="text-[#F4F1E8] font-medium leading-relaxed">
                    “{item.claimText}”
                  </p>
                  <p className="text-[#A3B5A9]">{item.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
