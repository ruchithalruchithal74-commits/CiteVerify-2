import {
  AlertTriangle,
  Check,
  FileText,
  FlaskConical,
  Loader2,
  Play,
  ScanText,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import type {
  DocumentReport,
  PipelineProgressEvent,
  WorkspaceUser,
} from '../types.ts';
import { formatBytes } from '../utils/verdicts.ts';

interface DocumentUploadPageProps {
  activeUser: WorkspaceUser;
  onVerificationComplete: (report: DocumentReport) => void;
  autoTriggerSample?: boolean;
  onSampleTriggerHandled?: () => void;
}

interface PreviewState {
  mode: 'file' | 'sample';
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
  previewText: string;
  totalCharacters: number;
  file?: File;
  expectedMatrix?: Array<{
    claimSubstring: string;
    caseLabel: string;
    expectedVerdict: string;
    expectedNli: string;
    expectedFlag?: string;
  }>;
}

const STAGES: Array<{ stage: 1 | 2 | 3 | 4 | 5 | 6; label: string }> = [
  { stage: 1, label: 'Reading document' },
  { stage: 2, label: 'Extracting claims & figures' },
  { stage: 3, label: 'Detecting citations' },
  { stage: 4, label: 'Retrieving OA full text' },
  { stage: 5, label: 'Comparing evidence' },
  { stage: 6, label: 'Generating verification report' },
];

export function DocumentUploadPage({
  activeUser,
  onVerificationComplete,
  autoTriggerSample = false,
  onSampleTriggerHandled,
}: DocumentUploadPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState<PipelineProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSamplePaper = async (startImmediately = false) => {
    setError(null);
    setLoadingPreview(true);
    try {
      const res = await fetch('/api/sample-paper');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sample paper.');
      const nextPreview: PreviewState = {
        mode: 'sample',
        filename: data.filename,
        fileSizeBytes: data.fileSizeBytes,
        fileType: 'SAMPLE',
        extractionMethod: 'Sample',
        ocrUsed: false,
        previewText: data.text,
        totalCharacters: data.text.length,
        expectedMatrix: data.expectedMatrix,
      };
      setPreview(nextPreview);
      if (startImmediately) {
        await runVerification(nextPreview);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load sample demonstration manuscript.');
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (autoTriggerSample) {
      onSampleTriggerHandled?.();
      loadSamplePaper(true);
    }
  }, [autoTriggerSample]);

  const handleFileSelected = async (file: File) => {
    setError(null);
    const lower = file.name.toLowerCase();
    const valid =
      lower.endsWith('.pdf') ||
      lower.endsWith('.txt') ||
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp');
    if (!valid) {
      setError(
        'Supported formats: PDF (.pdf, including scanned PDFs via Vision OCR), Plain Text (.txt), or Figure/Chart Images (.png, .jpg, .webp).'
      );
      return;
    }

    setLoadingPreview(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/extract-preview', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract document text.');
      }
      setPreview({
        mode: 'file',
        filename: data.filename,
        fileSizeBytes: data.fileSizeBytes,
        fileType: data.fileType,
        extractionMethod: data.extractionMethod || 'PDF Text Layer',
        ocrUsed: Boolean(data.ocrUsed),
        previewText: data.previewText,
        totalCharacters: data.totalCharacters,
        file,
      });
    } catch (err: any) {
      setError(err?.message || 'Document preview extraction failed.');
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const runVerification = async (targetPreview?: PreviewState) => {
    const active = targetPreview || preview;
    if (!active) return;

    setError(null);
    setVerifying(true);
    setProgress({
      stage: 1,
      stageName: 'Reading document',
      detail: `Initializing verification pipeline for ${active.filename}...`,
      percent: 6,
    });

    try {
      const formData = new FormData();
      formData.append('userId', activeUser.id);
      formData.append('userDisplayName', activeUser.displayName);
      if (active.mode === 'sample') {
        formData.append('mode', 'sample');
      } else if (active.file) {
        formData.append('file', active.file);
      }

      const response = await fetch('/api/verify-stream', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok || !response.body) {
        throw new Error('Verification stream failed to connect.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalReport: DocumentReport | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const lines = chunk.split('\n');
          let eventName = 'message';
          let dataLine = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            if (line.startsWith('data:')) dataLine += line.slice(5).trim();
          }
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine);

          if (eventName === 'progress') {
            setProgress(payload as PipelineProgressEvent);
          } else if (eventName === 'complete') {
            finalReport = payload.report as DocumentReport;
          } else if (eventName === 'error') {
            throw new Error(payload.error || 'Verification pipeline error.');
          }
        }
      }

      if (!finalReport) {
        throw new Error('Verification completed without returning a report.');
      }

      onVerificationComplete(finalReport);
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F1E8]">
            Document Upload & Ingestion
          </h1>
          <p className="text-sm text-[#A3B5A9] mt-1.5 max-w-2xl">
            Upload a research manuscript (PDF, scanned PDF with OCR fallback, TXT, or Figure/Chart image). CiteVerify extracts claims, inspects embedded graphs, retrieves Open-Access full text, and verifies NLI alignment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadSamplePaper(false)}
          disabled={verifying || loadingPreview}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#D6B875]/45 bg-[#14201C] text-xs font-semibold text-[#F4F1E8] hover:border-[#D6B875] transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FlaskConical className="w-4 h-4 text-[#D6B875]" />
          Load Sample Research Paper
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-[#E05265]/40 bg-[#E05265]/10 px-4 py-3.5 flex items-start gap-3 text-sm text-[#F4F1E8]">
          <AlertTriangle className="w-4 h-4 text-[#E05265] shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[#E05265]">Processing Error</p>
            <p className="text-xs text-[#F4F1E8]/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !verifying && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !verifying) {
                fileInputRef.current?.click();
              }
            }}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
              dragging
                ? 'border-[#19B887] bg-[#19B887]/10'
                : 'border-[#2D3D37] bg-[#1C2623] hover:border-[#19B887]/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelected(f);
              }}
            />
            <div className="w-12 h-12 rounded-xl bg-[#14201C] border border-[#2B3B35] flex items-center justify-center mx-auto mb-4">
              {loadingPreview ? (
                <Loader2 className="w-5 h-5 text-[#19B887] animate-spin" />
              ) : (
                <UploadCloud className="w-5 h-5 text-[#19B887]" />
              )}
            </div>
            <p className="font-display text-base font-semibold text-[#F4F1E8]">
              Drop PDF, TXT, or Chart Image here
            </p>
            <p className="text-xs text-[#A3B5A9] mt-1.5">
              Supports scanned PDFs (Vision OCR) & embedded figures · Max 15 MB
            </p>
          </div>

          {/* Document Metadata Summary */}
          <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-5">
            <h2 className="font-display text-base font-semibold text-[#F4F1E8] pb-3 border-b border-[#25322D]">
              Document Telemetry
            </h2>
            {preview ? (
              <dl className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#A3B5A9]">Filename</dt>
                  <dd className="font-mono text-[#F4F1E8] truncate max-w-[220px]">
                    {preview.filename}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#A3B5A9]">File Size</dt>
                  <dd className="font-mono tabular-nums text-[#F4F1E8]">
                    {formatBytes(preview.fileSizeBytes)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#A3B5A9]">Document Type</dt>
                  <dd className="font-mono text-[#D6B875]">
                    {preview.fileType === 'SAMPLE'
                      ? 'TXT (Sample Demonstration)'
                      : preview.fileType}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#A3B5A9]">Extraction Engine</dt>
                  <dd className="font-mono text-[#F4F1E8] inline-flex items-center gap-1.5">
                    {preview.ocrUsed && <ScanText className="w-3.5 h-3.5 text-[#19B887]" />}
                    {preview.extractionMethod}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#A3B5A9]">Extracted Length</dt>
                  <dd className="font-mono tabular-nums text-[#F4F1E8]">
                    {preview.totalCharacters.toLocaleString()} chars
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#A3B5A9]">Auditor Profile</dt>
                  <dd className="text-[#D6B875]">{activeUser.displayName}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#A3B5A9]">Processing Status</dt>
                  <dd className="font-mono text-[#19B887]">
                    {verifying
                      ? `Stage ${progress?.stage || 1}/6 Active`
                      : 'Ready for Verification'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-[#A3B5A9] mt-4">
                No document loaded yet. Upload a PDF, scanned manuscript, TXT, or figure image, or load the sample paper.
              </p>
            )}

            <button
              type="button"
              disabled={!preview || verifying || loadingPreview}
              onClick={() => runVerification()}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#19B887] text-[#0B1411] text-sm font-semibold hover:bg-[#1FD099] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Manuscript...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Verification
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live 6-Stage Pipeline + Preview */}
        <div className="lg:col-span-7 space-y-6">
          {verifying && progress && (
            <div className="rounded-xl border border-[#19B887]/40 bg-[#14201C] p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="font-mono text-xs text-[#19B887]">
                    Active Verification Pipeline
                  </p>
                  <h3 className="font-display text-lg font-semibold text-[#F4F1E8] mt-0.5">
                    {progress.stageName}
                  </h3>
                </div>
                <span className="font-mono text-sm font-semibold text-[#D6B875] tabular-nums">
                  {progress.percent}%
                </span>
              </div>

              <div className="w-full h-1.5 rounded-full bg-[#101414] overflow-hidden mb-5">
                <div
                  className="h-full bg-[#19B887] transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <p className="text-xs text-[#A3B5A9] mb-5">{progress.detail}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STAGES.map((st) => {
                  const done = progress.stage > st.stage;
                  const current = progress.stage === st.stage;
                  return (
                    <div
                      key={st.stage}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-xs ${
                        current
                          ? 'border-[#19B887]/50 bg-[#19B887]/10 text-[#F4F1E8]'
                          : done
                          ? 'border-[#22C58B]/25 bg-[#1C2623] text-[#22C58B]'
                          : 'border-[#24312C] bg-[#101414]/50 text-[#A3B5A9]/60'
                      }`}
                    >
                      <span className="font-mono w-5 shrink-0 tabular-nums">
                        {done ? (
                          <Check className="w-4 h-4 text-[#22C58B]" />
                        ) : current ? (
                          <Loader2 className="w-4 h-4 text-[#19B887] animate-spin" />
                        ) : (
                          `0${st.stage}`
                        )}
                      </span>
                      <span className="font-medium truncate">{st.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[#25322D] bg-[#1C2623] p-6">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#25322D]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#D6B875]" />
                <h2 className="font-display text-base font-semibold text-[#F4F1E8]">
                  Extracted Document Preview
                </h2>
              </div>
              {preview?.ocrUsed ? (
                <span className="font-mono text-xs text-[#19B887]">
                  Vision OCR Active
                </span>
              ) : preview?.mode === 'sample' ? (
                <span className="font-mono text-xs text-[#D6B875]">
                  Illustrative Demonstration Paper
                </span>
              ) : null}
            </div>

            {preview ? (
              <div className="mt-4 max-h-[380px] overflow-y-auto pr-2 font-mono text-xs leading-relaxed text-[#A3B5A9] whitespace-pre-wrap">
                {preview.previewText}
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-[#A3B5A9]">
                Document text extracted via PDF text parser, Vision OCR fallback (for scanned PDFs & chart images), or UTF-8 TXT reader will appear here before verification begins.
              </div>
            )}
          </div>

          {preview?.mode === 'sample' && preview.expectedMatrix && (
            <div className="rounded-xl border border-[#D6B875]/30 bg-[#14201C] p-5">
              <p className="font-mono text-xs text-[#D6B875] mb-1">
                Sample Demonstration Test Specification
              </p>
              <p className="text-xs text-[#A3B5A9] mb-4">
                This manuscript blends genuine published DOIs (queried live against OpenAlex, Crossref, Unpaywall & Europe PMC) with clearly labeled illustrative demonstration sources to exercise all 7 edge cases:
              </p>
              <div className="space-y-2">
                {preview.expectedMatrix.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs py-1.5 border-b border-[#22322C] last:border-b-0"
                  >
                    <span className="text-[#F4F1E8] font-medium">
                      {item.caseLabel}
                    </span>
                    <span className="font-mono text-[#A3B5A9]">
                      {item.expectedVerdict} · {item.expectedNli}
                      {item.expectedFlag ? ` · ${item.expectedFlag}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
