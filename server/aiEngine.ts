import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type {
  CitationFlag,
  ContextTrapResult,
  EvidenceDna,
  FigureAnalysis,
  NLIResult,
  NumericalCheckResult,
  ResearchSourceRecord,
  VerificationVerdict,
} from '../src/types.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured in the server environment.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function generateWithResilience(params: {
  contents: any;
  systemInstruction: string;
  responseMimeType?: string;
  responseSchema?: any;
  preferFastModel?: boolean;
  timeoutMs?: number;
}): Promise<string> {
  const ai = getGeminiClient();
  const baseTimeout = params.timeoutMs || 14000;
  const attempts: Array<{
    model: string;
    useThinking: boolean;
    delayMs: number;
    timeoutMs: number;
  }> = params.preferFastModel
    ? [
        {
          model: 'gemini-3.1-flash-lite',
          useThinking: false,
          delayMs: 0,
          timeoutMs: baseTimeout,
        },
        {
          model: 'gemini-4-hydrogen',
          useThinking: true,
          delayMs: 400,
          timeoutMs: baseTimeout,
        },
      ]
    : [
        {
          model: 'gemini-4-hydrogen',
          useThinking: true,
          delayMs: 0,
          timeoutMs: baseTimeout,
        },
        {
          model: 'gemini-3.1-flash-lite',
          useThinking: false,
          delayMs: 300,
          timeoutMs: baseTimeout + 4000,
        },
        {
          model: 'gemini-3.1-flash-lite',
          useThinking: false,
          delayMs: 1200,
          timeoutMs: baseTimeout + 4000,
        },
        {
          model: 'gemini-3.1-flash-lite',
          useThinking: false,
          delayMs: 2800,
          timeoutMs: baseTimeout + 4000,
        },
      ];

  let lastError: any = null;
  for (const attempt of attempts) {
    if (attempt.delayMs > 0) await sleep(attempt.delayMs);
    try {
      const config: any = {
        systemInstruction: params.systemInstruction,
      };
      if (params.responseMimeType) {
        config.responseMimeType = params.responseMimeType;
      }
      if (params.responseSchema) {
        config.responseSchema = params.responseSchema;
      }
      if (attempt.useThinking) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      const response = await withTimeout(
        ai.models.generateContent({
          model: attempt.model,
          contents: params.contents,
          config,
        }),
        attempt.timeoutMs,
        attempt.model
      );
      return (response.text ?? '').trim();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const isTransient =
        msg.includes('429') ||
        msg.includes('500') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('high demand') ||
        msg.includes('timed out') ||
        msg.includes('fetch') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('UNAVAILABLE');
      if (!isTransient) throw err;
    }
  }
  throw lastError || new Error('Gemini inference failed after retries.');
}

/**
 * Vision OCR Fallback for scanned / image-only PDFs or manuscript images
 */
export async function extractTextWithVisionOCR(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; error?: string }> {
  try {
    const base64Data = buffer.toString('base64');
    const text = await generateWithResilience({
      preferFastModel: true,
      timeoutMs: 28000,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: `Transcribe ALL readable academic text from this document accurately in reading order.
Preserve section headings (Abstract, Introduction, Methods, Results, Discussion, References), inline citations ([1], (Author, Year), DOIs), numerical tables, and the full References / Bibliography list.
If the image primarily shows a chart, graph, or figure, transcribe any title, axis labels, legend, caption, and numeric data points verbatim.`,
          },
        ],
      },
      systemInstruction:
        'You are a high-precision academic OCR and scientific document transcription engine. Transcribe only text and values visibly present in the document. Never invent citations or numbers.',
    });

    return { text };
  } catch (err: any) {
    return {
      text: '',
      error: err?.message || 'Vision OCR failed on document.',
    };
  }
}

/**
 * Multimodal Figure, Chart & Graph Analysis for uploaded PDFs and Images
 */
export async function analyzeDocumentFiguresAndGraphs(
  buffer: Buffer,
  mimeType: string,
  bodyTextSnippet: string
): Promise<{ figures: FigureAnalysis[]; warning?: string }> {
  // Guard size for inline multimodal payload (12MB raw -> ~16MB base64)
  if (buffer.length > 12 * 1024 * 1024) {
    return {
      figures: [],
      warning:
        'Multimodal figure/graph analysis skipped because the file exceeds the 12 MB inline vision limit.',
    };
  }

  try {
    const base64Data = buffer.toString('base64');
    const rawJson = await generateWithResilience({
      preferFastModel: true,
      timeoutMs: 24000,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: `Inspect this academic document/image for ANY scientific figures, charts, bar/line/scatter graphs, plots, diagrams, or data tables.
For each visual figure or graph found (up to 6):
1. "figureId": e.g., "Figure 1", "Chart 1", "Table 1".
2. "title": Concise caption or title visible on the figure.
3. "chartType": e.g., "Bar Chart", "Line Graph", "ROC Curve", "Scatter Plot", "Kaplan-Meier Curve", "Confusion Matrix", "Data Table", or "Diagram".
4. "axesAndUnits": Exact axis labels, scales, and units (e.g., "X: Epochs (0-100), Y: Accuracy (%)").
5. "extractedValues": Array of key numerical data points or metrics read from the graph/table (e.g., ["Model A: 62.4%", "Baseline: 48.1%"]).
6. "keyFinding": Concise factual summary of what the visual graph/figure actually shows.
7. "claimAlignmentStatus": Compare against the manuscript prose snippet below: "Aligned" if consistent, "Discrepancy Detected" if the prose misstates a figure/graph value or trend, or "Informational" if no matching prose claim appears in the snippet.
8. "claimAlignmentNote": 1-sentence explanation comparing visual chart values to prose claims.

If NO figures, charts, or graphs appear in the document, return an empty JSON array [].

MANUSCRIPT PROSE SNIPPET:
${bodyTextSnippet.slice(0, 8000)}`,
          },
        ],
      },
      systemInstruction:
        'You are a scientific figure and data-visualization integrity auditor. Report only figures, axes, and numbers visibly depicted in the uploaded document or image. Never hallucinate figures.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            figureId: { type: Type.STRING },
            title: { type: Type.STRING },
            chartType: { type: Type.STRING },
            axesAndUnits: { type: Type.STRING },
            extractedValues: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyFinding: { type: Type.STRING },
            claimAlignmentStatus: { type: Type.STRING },
            claimAlignmentNote: { type: Type.STRING },
          },
          required: [
            'figureId',
            'title',
            'chartType',
            'axesAndUnits',
            'extractedValues',
            'keyFinding',
            'claimAlignmentStatus',
            'claimAlignmentNote',
          ],
        },
      },
    });

    const parsed = JSON.parse(rawJson || '[]');
    if (!Array.isArray(parsed)) return { figures: [] };

    const figures: FigureAnalysis[] = parsed
      .filter((f: any) => f?.figureId && f?.keyFinding)
      .map((f: any) => ({
        figureId: String(f.figureId).trim(),
        title: String(f.title || 'Untitled Figure').trim(),
        chartType: String(f.chartType || 'Visual Figure').trim(),
        axesAndUnits: String(f.axesAndUnits || 'Not labeled').trim(),
        extractedValues: Array.isArray(f.extractedValues)
          ? f.extractedValues.map(String)
          : [],
        keyFinding: String(f.keyFinding).trim(),
        claimAlignmentStatus:
          f.claimAlignmentStatus === 'Discrepancy Detected' ||
          f.claimAlignmentStatus === 'Aligned'
            ? f.claimAlignmentStatus
            : 'Informational',
        claimAlignmentNote: String(f.claimAlignmentNote || '').trim(),
      }));

    return { figures };
  } catch (err: any) {
    return {
      figures: [],
      warning: `Figure/graph vision inspection could not complete: ${
        err?.message || 'Vision error'
      }`,
    };
  }
}

export interface ExtractedClaimDraft {
  claimText: string;
  section: string;
  matchedCitation: string;
  citationFormat: 'numbered' | 'author-year' | 'et-al' | 'doi' | 'missing';
}

function buildRepresentativeBodyWindow(bodyText: string, maxLen = 42000): string {
  if (bodyText.length <= maxLen) return bodyText;
  // Take Intro/Abstract (first 16k), Results/Middle (16k around 50% mark), Discussion (last 10k)
  const first = bodyText.slice(0, 16000);
  const midStart = Math.max(16000, Math.floor(bodyText.length * 0.42));
  const mid = bodyText.slice(midStart, midStart + 16000);
  const tail = bodyText.slice(-10000);
  return `${first}\n\n[...MIDDLE SECTIONS...]\n\n${mid}\n\n[...LATER SECTIONS...]\n\n${tail}`;
}

export async function extractClaimsWithLLM(
  bodyText: string,
  figures: FigureAnalysis[] = []
): Promise<{ claims: ExtractedClaimDraft[]; error?: string }> {
  try {
    const windowText = buildRepresentativeBodyWindow(bodyText);
    const figureContext =
      figures.length > 0
        ? `\n\nEXTRACTED FIGURES/GRAPHS IN THIS DOCUMENT:\n${figures
            .map(
              (f) =>
                `- ${f.figureId} (${f.chartType}): ${f.keyFinding} [Values: ${f.extractedValues.join(
                  ', '
                )}] (${f.claimAlignmentStatus}: ${f.claimAlignmentNote})`
            )
            .join('\n')}`
        : '';

    const rawJson = await generateWithResilience({
      preferFastModel: true,
      timeoutMs: 16000,
      contents: `Extract the distinct, verifiable scientific claims from the following academic manuscript body text.
For each claim:
- Extract the exact or near-verbatim scientific statement ("claimText").
- Identify the section name ("section", e.g., "Introduction", "Methods", "Results", "Discussion", or "Figure Analysis").
- Identify the inline citation immediately attached to that statement ("matchedCitation", e.g., "[1]", "(Smith et al., 2021)", "10.1038/...", or "None" if the claim makes an empirical assertion without any citation).
- Classify "citationFormat" as one of: "numbered", "author-year", "et-al", "doi", or "missing".
Extract up to 12 substantive scientific claims (prioritize empirical findings, statistical assertions, cited claims, and claims referencing figures/tables).

MANUSCRIPT BODY:
${windowText}${figureContext}`,
      systemInstruction:
        'You are a rigorous academic research integrity auditor. Extract only claims actually present in the provided text. Never invent claims or citations.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            claimText: { type: Type.STRING },
            section: { type: Type.STRING },
            matchedCitation: { type: Type.STRING },
            citationFormat: { type: Type.STRING },
          },
          required: [
            'claimText',
            'section',
            'matchedCitation',
            'citationFormat',
          ],
        },
      },
    });

    const parsed = JSON.parse(rawJson || '[]');
    if (!Array.isArray(parsed)) {
      return { claims: [], error: 'Model returned invalid claim structure.' };
    }

    const normalized: ExtractedClaimDraft[] = parsed
      .filter(
        (c: any) =>
          typeof c?.claimText === 'string' && c.claimText.trim().length > 12
      )
      .map((c: any) => {
        const fmt = ['numbered', 'author-year', 'et-al', 'doi', 'missing'].includes(
          c.citationFormat
        )
          ? c.citationFormat
          : c.matchedCitation === 'None' || !c.matchedCitation
          ? 'missing'
          : 'numbered';
        return {
          claimText: c.claimText.trim(),
          section: (c.section || 'Manuscript Body').trim(),
          matchedCitation:
            fmt === 'missing' ? 'None' : (c.matchedCitation || 'None').trim(),
          citationFormat: fmt,
        };
      });

    return { claims: normalized };
  } catch (err: any) {
    return {
      claims: [],
      error: err?.message || 'LLM claim extraction failed.',
    };
  }
}

export interface EvidenceEvaluationOutput {
  nli: NLIResult;
  relevantPassage?: string;
  findings?: string;
  limitations?: string;
  experimentalConditions?: string;
  contextTrap: ContextTrapResult;
  evidenceDna: EvidenceDna;
  verdict: VerificationVerdict;
  confidenceIndicator: 'High' | 'Moderate' | 'Low' | 'Indeterminate';
  confidenceExplanation: string;
  reason: string;
  isNumericDriftOnly?: boolean;
}

export interface BatchEvaluationInput {
  claimId: string;
  claimText: string;
  matchedCitation: string;
  citationFlags: CitationFlag[];
  source: ResearchSourceRecord;
  numericalCheck: NumericalCheckResult;
  targetedPremiseText?: string;
}

function buildNonEvaluatedOutput(
  input: BatchEvaluationInput,
  nliError?: string
): EvidenceEvaluationOutput {
  const { claimText, matchedCitation, citationFlags, source, numericalCheck } =
    input;
  const premise = input.targetedPremiseText || source.abstractText || '';
  const currentYear = new Date().getFullYear();
  const isOlderWork = Boolean(source.year && currentYear - source.year >= 8);

  if (citationFlags.includes('Missing Citation')) {
    return {
      nli: {
        label: 'NOT_EVALUATED',
        confidence: null,
        premise: '',
        hypothesis: claimText,
        explanation:
          'Natural Language Inference was not performed because no citation was attached to this empirical claim.',
        performed: false,
      },
      contextTrap: {
        detected: false,
        status: 'Unverifiable',
        changedPhrases: [],
        explanation:
          'Cannot evaluate experimental context alignment without a cited source publication.',
      },
      evidenceDna: {
        sourceAuthenticity: {
          status: 'Fail',
          summary: 'No citation provided',
          detail:
            'The statement asserts a scientific fact or metric without referencing any source.',
        },
        semanticAlignment: {
          status: 'Unavailable',
          summary: 'No source text',
          detail: 'Semantic alignment cannot be tested without a linked reference.',
        },
        numericalIntegrity: {
          status: numericalCheck.hasNumbers ? 'Caution' : 'Pass',
          summary: numericalCheck.hasNumbers
            ? 'Unreferenced figures'
            : 'No figures asserted',
          detail: numericalCheck.hasNumbers
            ? `Claim contains quantitative metrics (${numericalCheck.claimedValues.join(
                ', '
              )}) lacking source attribution.`
            : 'No quantitative values require verification.',
        },
        contextIntegrity: {
          status: 'Unavailable',
          summary: 'Unverifiable',
          detail:
            'Original experimental conditions are unknown because no paper was cited.',
        },
        temporalValidity: {
          status: 'Unavailable',
          summary: 'Unknown year',
          detail: 'Publication year cannot be evaluated without a reference.',
        },
      },
      verdict: 'Unsupported',
      confidenceIndicator: 'High',
      confidenceExplanation:
        'High confidence in missing-citation detection via syntactic and structural audit.',
      reason:
        'Empirical scientific assertion lacks an inline citation or bibliography reference.',
    };
  }

  const hasPassage = Boolean(premise && premise.trim().length > 20);

  if (!source.verified || !hasPassage) {
    const missingPub =
      !source.verified ||
      citationFlags.includes('Missing Publication') ||
      citationFlags.includes('Incorrect DOI');

    return {
      nli: {
        label: 'NOT_EVALUATED',
        confidence: null,
        premise: '',
        hypothesis: claimText,
        explanation: missingPub
          ? 'NLI verification was not performed because the cited publication could not be verified in OpenAlex or Crossref.'
          : 'NLI verification was not performed because neither an open abstract nor open-access full text could be retrieved for this verified record.',
        performed: false,
      },
      contextTrap: {
        detected: false,
        status: 'Unverifiable',
        changedPhrases: [],
        explanation:
          'Original experimental conditions could not be inspected because abstract and full-text passages are unavailable.',
      },
      evidenceDna: {
        sourceAuthenticity: {
          status: missingPub
            ? 'Fail'
            : citationFlags.length > 0
            ? 'Caution'
            : 'Pass',
          summary: missingPub
            ? 'Publication unverified'
            : citationFlags.length > 0
            ? citationFlags.join(', ')
            : 'Metadata verified',
          detail:
            source.retrievalNote ||
            (missingPub
              ? 'Could not locate this work in OpenAlex or Crossref.'
              : 'Record exists in OpenAlex/Crossref.'),
        },
        semanticAlignment: {
          status: 'Unavailable',
          summary: 'Passage unavailable',
          detail:
            'Open abstract and full-text body are not exposed by OpenAlex, Crossref, Unpaywall, or Europe PMC for this record.',
        },
        numericalIntegrity: {
          status: numericalCheck.hasNumbers ? 'Unavailable' : 'Pass',
          summary: numericalCheck.hasNumbers
            ? 'Cannot cross-check'
            : 'No figures asserted',
          detail: numericalCheck.explanation,
        },
        contextIntegrity: {
          status: 'Unavailable',
          summary: 'Passage unavailable',
          detail: 'Experimental context cannot be verified without source text.',
        },
        temporalValidity: {
          status: !source.year
            ? 'Unavailable'
            : isOlderWork
            ? 'Caution'
            : 'Pass',
          summary: source.year ? `Published ${source.year}` : 'Unknown year',
          detail: source.year
            ? isOlderWork
              ? `Published in ${source.year} (${
                  currentYear - source.year
                } years ago); check for newer consensus.`
              : `Published in ${source.year}; within recent research window.`
            : 'Publication year unavailable.',
        },
      },
      verdict: missingPub ? 'Unsupported' : 'Human Review',
      confidenceIndicator: missingPub ? 'Moderate' : 'Low',
      confidenceExplanation: missingPub
        ? 'Neither OpenAlex nor Crossref resolved the cited reference.'
        : 'Metadata resolved, but full text and abstract were unavailable for automated NLI.',
      reason: missingPub
        ? `Cited reference (${matchedCitation}) could not be verified in OpenAlex or Crossref.`
        : 'Source metadata verified, but original abstract/full-text passage is unavailable; human inspection of the full PDF is required.',
    };
  }

  return {
    nli: {
      label: 'NOT_EVALUATED',
      confidence: null,
      premise,
      hypothesis: claimText,
      explanation: `NLI inference was not performed due to AI service error: ${
        nliError || 'Unavailable'
      }.`,
      performed: false,
      error: nliError,
    },
    relevantPassage: premise,
    contextTrap: {
      detected: false,
      status: 'Unverifiable',
      changedPhrases: [],
      explanation:
        'Context Trap analysis was not evaluated because AI inference failed.',
    },
    evidenceDna: {
      sourceAuthenticity: {
        status: citationFlags.length > 0 ? 'Caution' : 'Pass',
        summary: source.verified ? 'Source verified' : 'Unverified',
        detail: source.retrievalNote || 'Metadata checked.',
      },
      semanticAlignment: {
        status: 'Unavailable',
        summary: 'Not evaluated',
        detail: 'NLI model was unavailable during this run.',
      },
      numericalIntegrity: {
        status:
          numericalCheck.status === 'Mismatch'
            ? 'Fail'
            : numericalCheck.status === 'Match'
            ? 'Pass'
            : numericalCheck.hasNumbers
            ? 'Caution'
            : 'Pass',
        summary: numericalCheck.status,
        detail: numericalCheck.explanation,
      },
      contextIntegrity: {
        status: 'Unavailable',
        summary: 'Not evaluated',
        detail: 'Context comparison requires the NLI engine.',
      },
      temporalValidity: {
        status: isOlderWork ? 'Caution' : 'Pass',
        summary: source.year ? `Published ${source.year}` : 'Unknown year',
        detail: source.year
          ? `Publication year ${source.year} retrieved from source metadata.`
          : 'Publication year unknown.',
      },
    },
    verdict: 'Human Review',
    confidenceIndicator: 'Indeterminate',
    confidenceExplanation:
      'Automated NLI was not performed because the AI inference service returned an error.',
    reason: `Source passage retrieved, but NLI inference failed (${
      nliError || 'API error'
    }). Marked for human review.`,
  };
}

export async function evaluateClaimsBatchWithEvidence(
  inputs: BatchEvaluationInput[]
): Promise<Map<string, EvidenceEvaluationOutput>> {
  const results = new Map<string, EvidenceEvaluationOutput>();
  const currentYear = new Date().getFullYear();

  const evaluable: BatchEvaluationInput[] = [];
  for (const inp of inputs) {
    const premise = inp.targetedPremiseText || inp.source.abstractText || '';
    const hasPassage = Boolean(premise && premise.trim().length > 20);
    if (
      inp.citationFlags.includes('Missing Citation') ||
      !inp.source.verified ||
      !hasPassage
    ) {
      results.set(inp.claimId, buildNonEvaluatedOutput(inp));
    } else {
      evaluable.push({ ...inp, targetedPremiseText: premise });
    }
  }

  if (evaluable.length === 0) return results;

  const chunkSize = 6;
  for (let start = 0; start < evaluable.length; start += chunkSize) {
    const batch = evaluable.slice(start, start + chunkSize);
    const itemsPrompt = batch
      .map(
        (b) => `--- ITEM ${b.claimId} ---
CITATION: ${b.matchedCitation}
PASSAGE SOURCE: ${b.source.passageSource}
PUBLICATION YEAR: ${b.source.year ?? 'Unknown'}
PREMISE (Retrieved Source Passage / Semantic Full-Text Chunks):
"""
${b.targetedPremiseText}
"""
HYPOTHESIS (Submitted Claim):
"""
${b.claimText}
"""
PRE-COMPUTED NUMERICAL CHECK: ${b.numericalCheck.status} — ${b.numericalCheck.explanation}
METADATA FLAGS: ${b.citationFlags.length > 0 ? b.citationFlags.join(', ') : 'None'}`
      )
      .join('\n\n');

    try {
      const rawJson = await generateWithResilience({
        timeoutMs: 18000,
        contents: `Evaluate EVERY item below independently. For each item, return one JSON object matching its exact "claimId".

${itemsPrompt}

RULES FOR EACH ITEM:
1. "nliLabel": Strictly classify PREMISE -> HYPOTHESIS as "ENTAILMENT", "CONTRADICTION", or "NEUTRAL".
   - ENTAILMENT: Premise directly establishes the claim including its quantitative figures and experimental scope.
   - CONTRADICTION: Premise conflicts with the claim (opposite direction, incompatible numbers/numeric drift, or negates claim).
   - NEUTRAL: Premise is related or partial, or the claim generalizes outside the premise's experimental context without contradiction.
2. "nliConfidence": Number 0.0 to 1.0.
3. "nliExplanation": 1-2 sentences explaining the NLI classification.
4. "relevantPassage": Copy EXACT verbatim sentence(s) from that item's PREMISE (never invent or paraphrase).
5. "findings": Findings explicitly stated in that PREMISE.
6. "limitations": Limitations explicitly stated or implied by scope in that PREMISE.
7. "experimentalConditions": Study population, lab vs real-world setting, sample size, or experimental boundaries in that PREMISE.
8. "contextTrapDetected": true if HYPOTHESIS shifts experimental conditions, setting (e.g., controlled laboratory environment -> real-world applications, murine/in-vitro -> human clinical), or population compared to PREMISE.
9. "originalContext": Short phrase describing PREMISE's actual conditions.
10. "submittedContext": Short phrase describing HYPOTHESIS's claimed conditions.
11. "changedPhrases": Array of specific shifted phrases (empty array if none).
12. "contextExplanation": Clear explanation of context alignment or Context Trap mismatch.
13. "semanticAlignmentStatus": "Pass" | "Caution" | "Fail".
14. "semanticAlignmentSummary": 2-4 word status summary.
15. "semanticAlignmentDetail": 1-sentence semantic alignment detail.
16. "numericalStatusOverride": "Mismatch" | "Match" | "Unverifiable" | "Not Applicable" (respect PRE-COMPUTED NUMERICAL CHECK; only mark "Mismatch" when the claim asserts quantitative metrics that conflict with reported figures in the same directional context — if the claim has no numbers, return "Not Applicable").
17. "numericalExplanation": Clear explanation of numerical comparison.
18. "temporalStatus": "Pass" | "Caution" (mark "Caution" if published >= 8 years ago in fast-moving clinical/AI field or superseded).
19. "temporalDetail": 1-sentence temporal validity assessment.
20. "verdict": Choose strictly from "Supported" | "Partially Supported" | "Unsupported" | "Contradictory" | "Potentially Outdated" | "Human Review".
    - If numerical mismatch/drift exists -> "Contradictory" (if figures conflict) or "Partially Supported" (if direction holds with altered magnitude).
    - If contextTrapDetected is true -> "Partially Supported" or "Unsupported".
    - If ENTAILMENT with no numerical/context traps -> "Supported" (or "Potentially Outdated" only if clearly superseded).
21. "confidenceIndicator": "High" | "Moderate" | "Low".
22. "confidenceExplanation": 1-sentence explanation of evidence strength and uncertainty.
23. "reason": Clear 2-sentence plain-English synthesis for the report.
24. "isNumericDriftOnly": true ONLY if the claim preserves the source's qualitative direction/conclusion and primarily exaggerates or alters quantitative numbers; false if the claim contradicts/reverses the qualitative finding itself (e.g. "degradation" vs "retained stability", "lowered mortality" vs "did not lower mortality").`,
        systemInstruction:
          'You are CiteVerify NLI and Scientific Evidence Auditor. Never fabricate passages, numbers, or publication details. Ground every judgment strictly in each item PREMISE.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              claimId: { type: Type.STRING },
              nliLabel: { type: Type.STRING },
              nliConfidence: { type: Type.NUMBER },
              nliExplanation: { type: Type.STRING },
              relevantPassage: { type: Type.STRING },
              findings: { type: Type.STRING },
              limitations: { type: Type.STRING },
              experimentalConditions: { type: Type.STRING },
              contextTrapDetected: { type: Type.BOOLEAN },
              originalContext: { type: Type.STRING },
              submittedContext: { type: Type.STRING },
              changedPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
              contextExplanation: { type: Type.STRING },
              semanticAlignmentStatus: { type: Type.STRING },
              semanticAlignmentSummary: { type: Type.STRING },
              semanticAlignmentDetail: { type: Type.STRING },
              numericalStatusOverride: { type: Type.STRING },
              numericalExplanation: { type: Type.STRING },
              temporalStatus: { type: Type.STRING },
              temporalDetail: { type: Type.STRING },
              verdict: { type: Type.STRING },
              confidenceIndicator: { type: Type.STRING },
              confidenceExplanation: { type: Type.STRING },
              reason: { type: Type.STRING },
              isNumericDriftOnly: { type: Type.BOOLEAN },
            },
            required: [
              'claimId',
              'nliLabel',
              'nliConfidence',
              'nliExplanation',
              'relevantPassage',
              'findings',
              'limitations',
              'experimentalConditions',
              'contextTrapDetected',
              'changedPhrases',
              'contextExplanation',
              'semanticAlignmentStatus',
              'semanticAlignmentSummary',
              'semanticAlignmentDetail',
              'temporalStatus',
              'temporalDetail',
              'verdict',
              'confidenceIndicator',
              'confidenceExplanation',
              'reason',
              'isNumericDriftOnly',
            ],
          },
        },
      });

      const parsedArr = JSON.parse(rawJson || '[]');
      const byId = new Map<string, any>();
      if (Array.isArray(parsedArr)) {
        for (const item of parsedArr) {
          if (item?.claimId) byId.set(String(item.claimId), item);
        }
      }

      for (const inp of batch) {
        const out = byId.get(inp.claimId);
        if (!out) {
          results.set(
            inp.claimId,
            buildNonEvaluatedOutput(inp, 'Batch response omitted claim ID.')
          );
          continue;
        }

        const premiseText = inp.targetedPremiseText!;
        const isOlderWork = Boolean(
          inp.source.year && currentYear - inp.source.year >= 8
        );

        const nliLabel = ['ENTAILMENT', 'CONTRADICTION', 'NEUTRAL'].includes(
          out.nliLabel
        )
          ? out.nliLabel
          : 'NEUTRAL';

        const validVerdicts: VerificationVerdict[] = [
          'Supported',
          'Partially Supported',
          'Unsupported',
          'Contradictory',
          'Potentially Outdated',
          'Human Review',
        ];
        const verdict: VerificationVerdict = validVerdicts.includes(out.verdict)
          ? out.verdict
          : 'Human Review';

        const confInd = ['High', 'Moderate', 'Low'].includes(
          out.confidenceIndicator
        )
          ? out.confidenceIndicator
          : 'Moderate';

        const candidatePassage = String(out.relevantPassage || '').trim();
        const verifiedPassage =
          candidatePassage.length > 15 &&
          premiseText
            .toLowerCase()
            .includes(candidatePassage.slice(0, 30).toLowerCase())
            ? candidatePassage
            : premiseText.slice(0, 1200);

        const numStatus = !inp.numericalCheck.hasNumbers
          ? 'Pass'
          : inp.numericalCheck.status === 'Mismatch'
          ? 'Fail'
          : inp.numericalCheck.status === 'Match'
          ? 'Pass'
          : out.numericalStatusOverride === 'Mismatch'
          ? 'Fail'
          : out.numericalStatusOverride === 'Match'
          ? 'Pass'
          : 'Caution';

        const temporalStatus =
          out.temporalStatus === 'Caution' || isOlderWork ? 'Caution' : 'Pass';
        const authStatus = inp.citationFlags.length > 0 ? 'Caution' : 'Pass';
        const semStatus = ['Pass', 'Caution', 'Fail'].includes(
          out.semanticAlignmentStatus
        )
          ? out.semanticAlignmentStatus
          : 'Caution';

        results.set(inp.claimId, {
          nli: {
            label: nliLabel,
            confidence:
              typeof out.nliConfidence === 'number'
                ? Math.min(1, Math.max(0, Number(out.nliConfidence.toFixed(2))))
                : 0.78,
            premise: verifiedPassage,
            hypothesis: inp.claimText,
            explanation: out.nliExplanation,
            performed: true,
          },
          relevantPassage: verifiedPassage,
          findings: out.findings,
          limitations: out.limitations,
          experimentalConditions: out.experimentalConditions,
          contextTrap: {
            detected: Boolean(out.contextTrapDetected),
            status: out.contextTrapDetected ? 'Context Mismatch' : 'Aligned',
            originalContext: out.originalContext,
            submittedContext: out.submittedContext,
            changedPhrases: Array.isArray(out.changedPhrases)
              ? out.changedPhrases
              : [],
            explanation: out.contextExplanation,
          },
          evidenceDna: {
            sourceAuthenticity: {
              status: authStatus,
              summary:
                inp.citationFlags.length > 0
                  ? inp.citationFlags.join(', ')
                  : inp.source.isIllustrativeDemo
                  ? 'Illustrative demo source'
                  : inp.source.fullTextRetrieved
                  ? 'Verified OA Full Text'
                  : 'Verified OpenAlex/Crossref',
              detail:
                inp.citationFlags.length > 0
                  ? `Source found, but flagged for: ${inp.citationFlags.join(
                      ', '
                    )}.`
                  : inp.source.isIllustrativeDemo
                  ? 'Illustrative synthetic corpus record used solely for demonstration testing.'
                  : `Publication confirmed in ${[
                      inp.source.openAlexFound ? 'OpenAlex' : '',
                      inp.source.crossrefFound ? 'Crossref' : '',
                      inp.source.unpaywallFound ? 'Unpaywall' : '',
                    ]
                      .filter(Boolean)
                      .join(' & ')}.`,
            },
            semanticAlignment: {
              status: semStatus as any,
              summary: out.semanticAlignmentSummary || 'Evaluated',
              detail: out.semanticAlignmentDetail,
            },
            numericalIntegrity: {
              status: numStatus,
              summary:
                numStatus === 'Fail'
                  ? 'Numerical mismatch'
                  : inp.numericalCheck.hasNumbers
                  ? numStatus === 'Pass'
                    ? 'Values verified'
                    : 'Partial / indirect'
                  : 'No figures asserted',
              detail:
                inp.numericalCheck.status === 'Mismatch'
                  ? inp.numericalCheck.explanation
                  : out.numericalExplanation || inp.numericalCheck.explanation,
            },
            contextIntegrity: {
              status: out.contextTrapDetected ? 'Fail' : 'Pass',
              summary: out.contextTrapDetected
                ? 'Context Mismatch'
                : 'Context preserved',
              detail: out.contextExplanation,
            },
            temporalValidity: {
              status: temporalStatus,
              summary: inp.source.year
                ? `Published ${inp.source.year}`
                : 'Year verified',
              detail: out.temporalDetail,
            },
          },
          verdict,
          confidenceIndicator: confInd as any,
          confidenceExplanation: out.confidenceExplanation,
          reason: out.reason,
          isNumericDriftOnly: Boolean(out.isNumericDriftOnly),
        });
      }
    } catch (err: any) {
      for (const inp of batch) {
        results.set(
          inp.claimId,
          buildNonEvaluatedOutput(inp, err?.message || 'AI batch inference failed.')
        );
      }
    }
  }

  return results;
}
