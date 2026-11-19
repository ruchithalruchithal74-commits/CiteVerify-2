import type { NumericalCheckResult } from '../src/types.ts';

interface ExtractedMetric {
  raw: string;
  value: number;
  unit: 'percent' | 'p-value' | 'sample-size' | 'fold' | 'absolute';
  unitLabel: string;
  contextWindow: string;
}

function parseFormattedNumber(rawNum: string): number {
  return parseFloat(rawNum.replace(/,/g, ''));
}

function normalizeUnitLabel(rawUnit: string): string {
  const lower = rawUnit.toLowerCase();
  const singularMap: Record<string, string> = {
    seconds: 'second',
    minutes: 'minute',
    hours: 'hour',
    days: 'day',
    weeks: 'week',
    months: 'month',
    years: 'year',
    patients: 'patient',
    participants: 'participant',
    samples: 'sample',
  };
  return singularMap[lower] || lower;
}

export function extractNumericMetrics(text: string): ExtractedMetric[] {
  if (!text) return [];
  const metrics: ExtractedMetric[] = [];

  // Percentages: e.g., 95%, -14.9%, 62.4%, 80 percent
  const pctRegex =
    /(?<![A-Za-z0-9.,])((?:-?\d{1,3}(?:,\d{3})+|-?\d+)(?:\.\d+)?)\s*(%|percent\b|percentage points?\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = pctRegex.exec(text)) !== null) {
    const start = Math.max(0, m.index - 40);
    const end = Math.min(text.length, m.index + m[0].length + 40);
    metrics.push({
      raw: m[0],
      value: parseFormattedNumber(m[1]),
      unit: 'percent',
      unitLabel: m[2].toLowerCase().includes('point') ? 'percentage points' : '%',
      contextWindow: text.slice(start, end).trim(),
    });
  }

  // P-values: p < 0.05, p = 0.001
  const pRegex = /\bp\s*([<>=≤≥])\s*(0?\.\d+)/gi;
  while ((m = pRegex.exec(text)) !== null) {
    const start = Math.max(0, m.index - 30);
    const end = Math.min(text.length, m.index + m[0].length + 30);
    metrics.push({
      raw: m[0],
      value: parseFloat(m[2]),
      unit: 'p-value',
      unitLabel: 'p-value',
      contextWindow: text.slice(start, end).trim(),
    });
  }

  // Sample size: n = 120, n = 5,000
  const nRegex = /\bn\s*=\s*((?:(?:\d{1,3}(?:,\d{3})+)|\d{2,7}))\b/gi;
  while ((m = nRegex.exec(text)) !== null) {
    const start = Math.max(0, m.index - 30);
    const end = Math.min(text.length, m.index + m[0].length + 30);
    metrics.push({
      raw: m[0],
      value: parseInt(m[1].replace(/,/g, ''), 10),
      unit: 'sample-size',
      unitLabel: 'sample size (n)',
      contextWindow: text.slice(start, end).trim(),
    });
  }

  // Fold changes: 2.5-fold, 12-fold, 3x
  const foldRegex = /(?<![A-Za-z0-9.,-])((?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d+)?)\s*(?:-?fold\b|x\b)/gi;
  while ((m = foldRegex.exec(text)) !== null) {
    const start = Math.max(0, m.index - 30);
    const end = Math.min(text.length, m.index + m[0].length + 30);
    metrics.push({
      raw: m[0],
      value: parseFormattedNumber(m[1]),
      unit: 'fold',
      unitLabel: 'fold',
      contextWindow: text.slice(start, end).trim(),
    });
  }

  // Quantitative measurements with units (supports "28-day", "1,000 hours", "0.96 Angstroms")
  const unitRegex =
    /(?<![A-Za-z0-9.,-])((?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d+)?)(?:\s+|-)((?:ms|seconds?|minutes?|hours?|days?|weeks?|months?|years?|mg\/dL|mg|kg|mL|mmHg|Angstroms?|patients?|participants?|samples?))\b/gi;
  while ((m = unitRegex.exec(text)) !== null) {
    const val = parseFormattedNumber(m[1]);
    const normUnit = normalizeUnitLabel(m[2]);
    // Skip calendar years like "2021 year"
    if (normUnit === 'year' && val > 1900 && val < 2100) {
      continue;
    }
    const start = Math.max(0, m.index - 35);
    const end = Math.min(text.length, m.index + m[0].length + 35);
    metrics.push({
      raw: m[0],
      value: val,
      unit: 'absolute',
      unitLabel: normUnit,
      contextWindow: text.slice(start, end).trim(),
    });
  }

  return metrics;
}

export function runRuleBasedNumericalCheck(
  claimText: string,
  evidencePassage?: string
): NumericalCheckResult {
  const claimMetrics = extractNumericMetrics(claimText);
  if (claimMetrics.length === 0) {
    return {
      hasNumbers: false,
      status: 'Not Applicable',
      claimedValues: [],
      reportedValues: [],
      explanation:
        'The submitted claim does not assert specific quantitative measurements, percentages, or statistical thresholds.',
    };
  }

  const claimedValues = claimMetrics.map((m) => m.raw);

  if (!evidencePassage || evidencePassage.trim().length < 15) {
    return {
      hasNumbers: true,
      status: 'Unverifiable',
      claimedValues,
      reportedValues: [],
      explanation:
        'Quantitative values were detected in the claim, but no original source passage was available to verify them.',
    };
  }

  const evidenceMetrics = extractNumericMetrics(evidencePassage);
  const reportedValues = evidenceMetrics.map((m) => m.raw);

  if (evidenceMetrics.length === 0) {
    return {
      hasNumbers: true,
      status: 'Unverifiable',
      claimedValues,
      reportedValues: [],
      explanation:
        `Claim specifies ${claimedValues.join(', ')}, whereas the retrieved source passage contains no matching quantitative figures to confirm or refute these numbers.`,
    };
  }

  const mismatches: string[] = [];
  const matches: string[] = [];

  for (const cm of claimMetrics) {
    const sameUnitCandidates = evidenceMetrics.filter(
      (em) =>
        em.unit === cm.unit &&
        (cm.unit !== 'absolute' || em.unitLabel === cm.unitLabel)
    );
    if (sameUnitCandidates.length === 0) continue;

    const sorted = [...sameUnitCandidates].sort(
      (a, b) => Math.abs(a.value - cm.value) - Math.abs(b.value - cm.value)
    );
    const closest = sorted[0];
    const diff = Math.abs(cm.value - closest.value);

    if (diff <= 0.05) {
      matches.push(`${cm.raw} matches source (${closest.raw})`);
    } else {
      if (cm.unit === 'percent') {
        const roundedDiff = Number(diff.toFixed(2));
        mismatches.push(
          `Claimed value: ${cm.raw}. Reported value: ${closest.raw}. Difference: ${roundedDiff} percentage points.`
        );
      } else {
        mismatches.push(
          `Claimed value: ${cm.raw}. Reported value: ${closest.raw}. Difference: ${Number(
            diff.toFixed(3)
          )} ${cm.unitLabel}.`
        );
      }
    }
  }

  if (mismatches.length > 0) {
    return {
      hasNumbers: true,
      status: 'Mismatch',
      claimedValues,
      reportedValues,
      differenceSummary: mismatches.join(' '),
      explanation: `Numerical discrepancy detected. ${mismatches.join(
        ' '
      )} Verify baselines, relative vs. absolute percentages, and experimental subgroups.`,
    };
  }

  if (matches.length > 0) {
    return {
      hasNumbers: true,
      status: 'Match',
      claimedValues,
      reportedValues,
      explanation: `Quantitative alignment confirmed: ${matches.join('; ')}.`,
    };
  }

  return {
    hasNumbers: true,
    status: 'Unverifiable',
    claimedValues,
    reportedValues,
    explanation: `Claimed values (${claimedValues.join(
      ', '
    )}) and source values (${reportedValues.join(
      ', '
    )}) use different units or refer to non-comparable metrics.`,
  };
}
