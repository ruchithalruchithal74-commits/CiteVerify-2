import type { EvidenceDna } from '../types.ts';
import { DNA_STATUS_STYLES } from '../utils/verdicts.ts';

interface EvidenceDnaCardProps {
  dna: EvidenceDna;
  compact?: boolean;
}

const DIMENSIONS: Array<{
  key: keyof EvidenceDna;
  code: string;
  label: string;
  question: string;
}> = [
  {
    key: 'sourceAuthenticity',
    code: 'A',
    label: 'Source Authenticity',
    question: 'Does the cited publication genuinely exist?',
  },
  {
    key: 'semanticAlignment',
    code: 'B',
    label: 'Semantic Alignment',
    question: 'Does the source discuss the same scientific concept?',
  },
  {
    key: 'numericalIntegrity',
    code: 'C',
    label: 'Numerical Integrity',
    question: 'Do percentages, units, and statistics match?',
  },
  {
    key: 'contextIntegrity',
    code: 'D',
    label: 'Context Integrity',
    question: 'Is the finding preserved in its original scope?',
  },
  {
    key: 'temporalValidity',
    code: 'E',
    label: 'Temporal Validity',
    question: 'Could the evidence be outdated or superseded?',
  },
];

export function EvidenceDnaCard({ dna, compact = false }: EvidenceDnaCardProps) {
  return (
    <div className="rounded-xl border border-[#283530] bg-[#141D1A] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 mb-4 border-b border-[#24302B]">
        <div>
          <h4 className="font-display text-base font-semibold text-[#F4F1E8]">
            Evidence DNA™ Profile
          </h4>
          <p className="text-xs text-[#A3B5A9] mt-0.5">
            Five independent verification dimensions — evaluated separately without an aggregated truth score.
          </p>
        </div>
        <span className="font-mono text-xs text-[#D6B875] whitespace-nowrap">
          5-Axis Diagnostic
        </span>
      </div>

      <div className={compact ? 'space-y-2.5' : 'grid grid-cols-1 md:grid-cols-5 gap-3'}>
        {DIMENSIONS.map((dim) => {
          const val = dna[dim.key];
          const tone = DNA_STATUS_STYLES[val.status];
          return (
            <div
              key={dim.key}
              className="rounded-lg border p-3 transition-colors"
              style={{
                backgroundColor: tone.bg,
                borderColor: tone.border,
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-[11px] font-medium text-[#A3B5A9]">
                  {dim.code}. {dim.label}
                </span>
                <span
                  className="font-mono text-xs font-semibold whitespace-nowrap"
                  style={{ color: tone.color }}
                >
                  {tone.symbol} {val.status}
                </span>
              </div>
              <p className="text-xs font-medium text-[#F4F1E8] leading-snug">
                {val.summary}
              </p>
              {!compact && (
                <p className="text-[11px] text-[#A3B5A9] mt-1.5 leading-relaxed">
                  {val.detail}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
