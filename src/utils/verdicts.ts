import type {
  EvidenceDnaStatus,
  NLILabel,
  VerificationVerdict,
} from '../types.ts';

export const VERDICT_COLORS: Record<VerificationVerdict, string> = {
  Supported: '#22C58B',
  'Partially Supported': '#E9AC45',
  Unsupported: '#F07867',
  Contradictory: '#E05265',
  'Potentially Outdated': '#A78BFA',
  'Human Review': '#56B4D3',
};

export const VERDICT_SYMBOLS: Record<VerificationVerdict, string> = {
  Supported: '✓',
  'Partially Supported': '◐',
  Unsupported: '○',
  Contradictory: '✕',
  'Potentially Outdated': '◷',
  'Human Review': '⚑',
};

export const NLI_COLORS: Record<NLILabel, string> = {
  ENTAILMENT: '#22C58B',
  CONTRADICTION: '#E05265',
  NEUTRAL: '#E9AC45',
  NOT_EVALUATED: '#A3B5A9',
};

export const DNA_STATUS_STYLES: Record<
  EvidenceDnaStatus,
  { color: string; symbol: string; bg: string; border: string }
> = {
  Pass: {
    color: '#22C58B',
    symbol: '✓',
    bg: 'rgba(34, 197, 139, 0.08)',
    border: 'rgba(34, 197, 139, 0.25)',
  },
  Caution: {
    color: '#E9AC45',
    symbol: '▲',
    bg: 'rgba(233, 172, 69, 0.08)',
    border: 'rgba(233, 172, 69, 0.25)',
  },
  Fail: {
    color: '#E05265',
    symbol: '✕',
    bg: 'rgba(224, 82, 101, 0.08)',
    border: 'rgba(224, 82, 101, 0.25)',
  },
  Unavailable: {
    color: '#A3B5A9',
    symbol: '—',
    bg: 'rgba(163, 181, 169, 0.06)',
    border: 'rgba(163, 181, 169, 0.2)',
  },
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
