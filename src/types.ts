export type VerificationVerdict =
  | 'Supported'
  | 'Partially Supported'
  | 'Unsupported'
  | 'Contradictory'
  | 'Potentially Outdated'
  | 'Human Review';

export type NLILabel =
  | 'ENTAILMENT'
  | 'CONTRADICTION'
  | 'NEUTRAL'
  | 'NOT_EVALUATED';

export type EvidenceDnaStatus = 'Pass' | 'Caution' | 'Fail' | 'Unavailable';

export interface EvidenceDnaDimension {
  status: EvidenceDnaStatus;
  summary: string;
  detail: string;
}

export interface EvidenceDna {
  sourceAuthenticity: EvidenceDnaDimension;
  semanticAlignment: EvidenceDnaDimension;
  numericalIntegrity: EvidenceDnaDimension;
  contextIntegrity: EvidenceDnaDimension;
  temporalValidity: EvidenceDnaDimension;
}

export type CitationFlag =
  | 'Missing Citation'
  | 'Incorrect DOI'
  | 'Missing Publication'
  | 'Author Mismatch'
  | 'Year Mismatch'
  | 'Unrelated Citation'
  | 'Duplicate Reference';

export interface BibliographyEntry {
  index?: number;
  rawText: string;
  title?: string;
  authors: string[];
  year?: number;
  doi?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
}

export interface DetectedCitation {
  rawText: string;
  format: 'numbered' | 'author-year' | 'et-al' | 'doi';
  position: number;
  matchedBibEntry?: BibliographyEntry;
}

export interface FigureAnalysis {
  figureId: string;
  title: string;
  chartType: string;
  axesAndUnits: string;
  extractedValues: string[];
  keyFinding: string;
  claimAlignmentStatus: 'Aligned' | 'Discrepancy Detected' | 'Informational';
  claimAlignmentNote: string;
}

export interface ResearchSourceRecord {
  verified: boolean;
  openAlexFound: boolean;
  crossrefFound: boolean;
  unpaywallFound?: boolean;
  openAlexId?: string;
  title?: string;
  authors: string[];
  year?: number;
  doi?: string;
  journal?: string;
  sourceUrl?: string;
  openAccessUrl?: string;
  fullTextRetrieved?: boolean;
  fullTextChunksUsed?: string[];
  abstractText?: string;
  relevantPassage?: string;
  passageSource:
    | 'Open-Access Full Text (PDF)'
    | 'Open-Access Full Text (HTML/XML)'
    | 'Europe PMC Full Text'
    | 'OpenAlex Abstract'
    | 'Crossref Abstract'
    | 'Europe PMC Abstract'
    | 'Semantic Scholar Abstract'
    | 'Illustrative Demo Corpus'
    | 'Unavailable';
  findings?: string;
  limitations?: string;
  experimentalConditions?: string;
  citedByCount?: number;
  isIllustrativeDemo?: boolean;
  retrievalNote?: string;
}

export interface NLIResult {
  label: NLILabel;
  confidence: number | null;
  premise: string;
  hypothesis: string;
  explanation: string;
  performed: boolean;
  error?: string;
}

export interface NumericalCheckResult {
  hasNumbers: boolean;
  status: 'Match' | 'Mismatch' | 'Unverifiable' | 'Not Applicable';
  claimedValues: string[];
  reportedValues: string[];
  differenceSummary?: string;
  explanation: string;
}

export interface ContextTrapResult {
  detected: boolean;
  status: 'Aligned' | 'Context Mismatch' | 'Unverifiable';
  originalContext?: string;
  submittedContext?: string;
  changedPhrases: string[];
  explanation: string;
}

export type HumanReviewDecision =
  | 'Pending'
  | 'Reviewed'
  | 'Accepted'
  | 'Rejected';

export interface ReviewHistoryItem {
  id: string;
  timestamp: string;
  action: string;
  decision: HumanReviewDecision;
  comment?: string;
  reviewer: string;
}

export interface HumanReviewRecord {
  decision: HumanReviewDecision;
  comments: string;
  lastUpdated?: string;
  history: ReviewHistoryItem[];
}

export interface ClaimAnalysis {
  id: string;
  claimText: string;
  section: string;
  matchedCitation: string;
  citationFormat: 'numbered' | 'author-year' | 'et-al' | 'doi' | 'missing';
  citationFlags: CitationFlag[];
  bibliographyEntry?: BibliographyEntry;
  source: ResearchSourceRecord;
  nli: NLIResult;
  numericalCheck: NumericalCheckResult;
  contextTrap: ContextTrapResult;
  evidenceDna: EvidenceDna;
  verdict: VerificationVerdict;
  confidenceIndicator: 'High' | 'Moderate' | 'Low' | 'Indeterminate';
  confidenceExplanation: string;
  reason: string;
  expectedDemoOutcome?: string;
  humanReview: HumanReviewRecord;
}

export interface CitationAuditItem {
  citationText: string;
  format: string;
  flags: CitationFlag[];
  bibliographyText?: string;
  resolvedTitle?: string;
  doi?: string;
  verified: boolean;
}

export interface DocumentSummaryStats {
  totalClaims: number;
  citationsFound: number;
  verifiedSources: number;
  fullTextSources: number;
  supportedClaims: number;
  partiallySupportedClaims: number;
  unsupportedClaims: number;
  contradictoryClaims: number;
  potentiallyOutdatedClaims: number;
  claimsNeedingReview: number;
  numericalMismatches: number;
  contextTrapsDetected: number;
  citationIssuesCount: number;
  figuresAnalyzed: number;
}

export interface TimelineBucket {
  year: string;
  sources: number;
  verified: number;
}

export interface DocumentReport {
  reportId: string;
  userId: string;
  userDisplayName: string;
  filename: string;
  fileSizeBytes: number;
  fileType: 'PDF' | 'TXT' | 'IMAGE' | 'SAMPLE';
  extractionMethod:
    | 'PDF Text Layer'
    | 'Gemini Vision OCR'
    | 'Plain Text'
    | 'Image Vision'
    | 'Sample';
  ocrUsed: boolean;
  uploadedAt: string;
  isSampleDemo: boolean;
  extractedTextPreview: string;
  totalCharacters: number;
  bibliographyEntries: BibliographyEntry[];
  detectedCitations: DetectedCitation[];
  citationAudit: CitationAuditItem[];
  figuresAnalyzed: FigureAnalysis[];
  claims: ClaimAnalysis[];
  summaryStats: DocumentSummaryStats;
  timelineData: TimelineBucket[];
  pipelineWarnings: string[];
}

export interface PipelineProgressEvent {
  stage: 1 | 2 | 3 | 4 | 5 | 6;
  stageName: string;
  detail: string;
  percent: number;
}

export type BenchmarkCategory =
  | 'Supported'
  | 'Numeric-Drift'
  | 'Contradicted'
  | 'Fabricated';

export interface BenchmarkClassMetrics {
  category: BenchmarkCategory;
  total: number;
  predictedPositive: number;
  truePositive: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface BenchmarkItemResult {
  id: string;
  domain: string;
  expectedCategory: BenchmarkCategory;
  predictedCategory: BenchmarkCategory;
  correct: boolean;
  claimText: string;
  nliLabel: NLILabel;
  numericalStatus: string;
  contextTrapDetected: boolean;
  latencyMs?: number;
  rationale: string;
}

export interface BenchmarkRunSummary {
  runId: string;
  ranAt: string;
  userId: string;
  totalItems: number;
  correctItems: number;
  overallAccuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  durationMs: number;
  classMetrics: BenchmarkClassMetrics[];
  confusionMatrix: Record<BenchmarkCategory, Record<BenchmarkCategory, number>>;
  items: BenchmarkItemResult[];
}

export interface WorkspaceUser {
  id: string;
  displayName: string;
  role: string;
}
