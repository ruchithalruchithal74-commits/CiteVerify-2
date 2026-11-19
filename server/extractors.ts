import { extractText } from 'unpdf';
import type { BibliographyEntry, DetectedCitation } from '../src/types.ts';
import { extractTextWithVisionOCR } from './aiEngine.ts';

function inferMimeType(filename: string, mimeType: string): string {
  const lower = filename.toLowerCase();
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'text/plain';
}

export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{
  text: string;
  fileType: 'PDF' | 'TXT' | 'IMAGE';
  ocrUsed: boolean;
  extractionMethod:
    | 'PDF Text Layer'
    | 'Gemini Vision OCR'
    | 'Plain Text'
    | 'Image Vision';
}> {
  const lower = filename.toLowerCase();
  const effectiveMime = inferMimeType(filename, mimeType);

  if (
    effectiveMime.startsWith('image/') ||
    /\.(png|jpe?g|webp)$/i.test(lower)
  ) {
    const ocr = await extractTextWithVisionOCR(buffer, effectiveMime);
    const cleaned = normalizeWhitespace(ocr.text);
    if (!cleaned || cleaned.length < 15) {
      throw new Error(
        ocr.error ||
          'Could not transcribe readable scientific text or figure data from the uploaded image.'
      );
    }
    return {
      text: cleaned,
      fileType: 'IMAGE',
      ocrUsed: true,
      extractionMethod: 'Image Vision',
    };
  }

  if (lower.endsWith('.pdf') || effectiveMime === 'application/pdf') {
    let cleaned = '';
    try {
      const uint8 = new Uint8Array(buffer);
      const result = await extractText(uint8, { mergePages: true });
      const rawText = Array.isArray(result.text)
        ? result.text.join('\n')
        : String(result.text || '');
      cleaned = normalizeWhitespace(rawText);
    } catch {
      cleaned = '';
    }

    // OCR Fallback if PDF appears scanned / image-only (< 150 chars of text layer)
    if (!cleaned || cleaned.length < 150) {
      const ocr = await extractTextWithVisionOCR(buffer, 'application/pdf');
      const ocrCleaned = normalizeWhitespace(ocr.text);
      if (ocrCleaned && ocrCleaned.length >= 30) {
        return {
          text: ocrCleaned,
          fileType: 'PDF',
          ocrUsed: true,
          extractionMethod: 'Gemini Vision OCR',
        };
      }
      if (!cleaned || cleaned.length < 25) {
        throw new Error(
          ocr.error ||
            'The uploaded PDF yielded insufficient embedded text and Vision OCR fallback could not extract readable text.'
        );
      }
    }

    return {
      text: cleaned,
      fileType: 'PDF',
      ocrUsed: false,
      extractionMethod: 'PDF Text Layer',
    };
  }

  if (lower.endsWith('.txt') || effectiveMime.startsWith('text/')) {
    const rawText = buffer.toString('utf-8');
    const cleaned = normalizeWhitespace(rawText);
    if (!cleaned || cleaned.length < 20) {
      throw new Error('The uploaded TXT file is empty or too short for analysis.');
    }
    return {
      text: cleaned,
      fileType: 'TXT',
      ocrUsed: false,
      extractionMethod: 'Plain Text',
    };
  }

  throw new Error(
    'Unsupported file format. Please upload a PDF, TXT, or academic figure image (PNG/JPG/WEBP).'
  );
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitBodyAndBibliography(fullText: string): {
  bodyText: string;
  bibliographySection: string;
} {
  // Match explicit section headings including numbered ones like "6. References" or "IV. REFERENCES"
  const headingRegex =
    /(?:^|\n)\s*(?:(?:\d+\.?|[IVX]+\.?)\s+)?(?:references|bibliography|works cited|literature cited|cited literature)\s*(?:\n|:|$)/gi;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(fullText)) !== null) {
    // Prefer a match in the second half of the document if multiple occur
    if (m.index > fullText.length * 0.25 || !lastMatch) {
      lastMatch = m;
    }
  }

  if (lastMatch && lastMatch.index !== undefined) {
    return {
      bodyText: fullText.slice(0, lastMatch.index).trim(),
      bibliographySection: fullText.slice(lastMatch.index).trim(),
    };
  }

  // Heuristic fallback: look for a trailing block of numbered references starting with [1] near the end
  const fallbackStart = fullText.search(/\n\[1\]\s+[A-Z][a-zA-Z'-]+/);
  if (fallbackStart !== -1 && fallbackStart > fullText.length * 0.45) {
    return {
      bodyText: fullText.slice(0, fallbackStart).trim(),
      bibliographySection: fullText.slice(fallbackStart).trim(),
    };
  }

  return { bodyText: fullText, bibliographySection: '' };
}

export function parseBibliographyEntries(bibText: string): BibliographyEntry[] {
  if (!bibText) return [];

  const lines = bibText
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 8 &&
        !/^(?:(?:\d+\.?|[IVX]+\.?)\s+)?(?:references|bibliography|works cited|literature cited|cited literature):?$/i.test(
          l
        )
    );

  // Merge wrapped lines belonging to the same reference entry
  const entriesRaw: string[] = [];
  for (const line of lines) {
    const startsNew =
      /^\[\d+\]/.test(line) ||
      /^\(\d+\)\s+[A-Z]/.test(line) ||
      /^\d+\.\s+[A-Z]/.test(line) ||
      /^[A-Z][a-zA-Z'-]+,\s*[A-Z]/.test(line);
    if (startsNew || entriesRaw.length === 0) {
      entriesRaw.push(line);
    } else {
      entriesRaw[entriesRaw.length - 1] += ' ' + line;
    }
  }

  const seenDois = new Map<string, string>();
  const seenTitles = new Map<string, string>();

  return entriesRaw.map((raw) => {
    const indexMatch = raw.match(/^\[(\d+)\]|^\((\d+)\)|^(\d+)\./);
    const index = indexMatch
      ? Number(indexMatch[1] || indexMatch[2] || indexMatch[3])
      : undefined;

    const doiMatch = raw.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/);
    const doi = doiMatch
      ? doiMatch[1].replace(/[.,;)\]]+$/, '')
      : undefined;

    const yearMatch = raw.match(/\b(19\d{2}|20[0-2]\d)\b/);
    const year = yearMatch ? Number(yearMatch[1]) : undefined;

    // Attempt to extract title (often quoted or between year and journal/DOI)
    let title: string | undefined;
    const quotedTitle = raw.match(/[“"]([^”"]{12,240})[”"]/);
    if (quotedTitle) {
      title = quotedTitle[1].trim();
    } else {
      const afterYear = raw.replace(/^.*?(\(?(?:19|20)\d{2}\)?[.,;:\s]+)/, '');
      const segments = afterYear.split(/\.\s+/);
      if (segments[0] && segments[0].length > 15 && segments[0].length < 260) {
        title = segments[0].replace(/^\[?\d+\]?\s*/, '').trim();
      } else {
        // Vancouver / Nature style without year first: "Author... Title. Journal Year;"
        const withoutNum = raw.replace(/^(?:\[\d+\]|\(\d+\)|\d+\.)\s*/, '');
        const parts = withoutNum.split(/\.\s+/);
        if (parts.length >= 2 && parts[1].length > 15 && parts[1].length < 240) {
          title = parts[1].trim();
        }
      }
    }

    const cleanedStart = raw.replace(/^\[\d+\]\s*|^\(\d+\)\s*|^\d+\.\s*/, '');
    const beforeYearOrTitle = cleanedStart
      .split(/\(\d{4}\)|\b(?:19|20)\d{2}\b|[“"]/)[0]
      .trim();
    const authorCandidates = beforeYearOrTitle
      .split(/,|&|\band\b/i)
      .map((s) => s.trim())
      .filter((s) => /^[A-Z][a-zA-Z'-]{1,30}/.test(s) && s.length < 35)
      .slice(0, 5);

    let isDuplicate = false;
    let duplicateOf: string | undefined;

    if (doi) {
      const normDoi = doi.toLowerCase();
      if (seenDois.has(normDoi)) {
        isDuplicate = true;
        duplicateOf = seenDois.get(normDoi);
      } else {
        seenDois.set(normDoi, index ? `[${index}]` : doi);
      }
    }

    if (!isDuplicate && title) {
      const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normTitle.length > 20 && seenTitles.has(normTitle)) {
        isDuplicate = true;
        duplicateOf = seenTitles.get(normTitle);
      } else if (normTitle.length > 20) {
        seenTitles.set(normTitle, index ? `[${index}]` : title.slice(0, 40));
      }
    }

    return {
      index,
      rawText: raw,
      title,
      authors: authorCandidates,
      year,
      doi,
      isDuplicate,
      duplicateOf,
    };
  });
}

export function detectInlineCitations(
  bodyText: string,
  bibEntries: BibliographyEntry[]
): DetectedCitation[] {
  const results: DetectedCitation[] = [];
  const seenKeys = new Set<string>();

  // 1. Numbered bracket citations: [1], [1, 2], [1-3]
  const numberedRegex = /\[(\d+(?:\s*[-–,]\s*\d+)*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = numberedRegex.exec(bodyText)) !== null) {
    const raw = m[0];
    const firstNum = Number(m[1].match(/\d+/)?.[0]);
    const matchedBibEntry = bibEntries.find((b) => b.index === firstNum);
    const key = `num:${raw}:${m.index}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      results.push({
        rawText: raw,
        format: 'numbered',
        position: m.index,
        matchedBibEntry,
      });
    }
  }

  // 2. Numbered parenthetical citations when numbered bibliography exists: (1), (1, 2)
  if (bibEntries.some((b) => typeof b.index === 'number')) {
    const parenNumRegex = /\((\d+(?:\s*[-–,]\s*\d+)*)\)/g;
    while ((m = parenNumRegex.exec(bodyText)) !== null) {
      const firstNum = Number(m[1].match(/\d+/)?.[0]);
      if (firstNum < 1 || firstNum > Math.max(200, bibEntries.length + 10)) continue;
      // Avoid matching years like (2021)
      if (firstNum >= 1900 && firstNum <= 2100) continue;
      const matchedBibEntry = bibEntries.find((b) => b.index === firstNum);
      if (!matchedBibEntry) continue;
      const raw = m[0];
      const key = `pnum:${raw}:${m.index}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push({
          rawText: raw,
          format: 'numbered',
          position: m.index,
          matchedBibEntry,
        });
      }
    }
  }

  // 3. Author-Year parenthetical: (Smith, 2020), (Vaswani et al., 2017), (Smith et al. 2020)
  const authorYearRegex =
    /\(([A-Z][a-zA-Z'-]+(?:\s+(?:et al\.|and\s+[A-Z][a-zA-Z'-]+|&\s+[A-Z][a-zA-Z'-]+))?,?\s*(?:19|20)\d{2}[a-z]?(?:\s*;\s*[A-Z][^)]+)*)\)/g;
  while ((m = authorYearRegex.exec(bodyText)) !== null) {
    const raw = m[0];
    const surname = m[1].match(/^([A-Z][a-zA-Z'-]+)/)?.[1]?.toLowerCase();
    const yearMatch = m[1].match(/\b((?:19|20)\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : undefined;
    const matchedBibEntry = bibEntries.find(
      (b) =>
        surname &&
        b.rawText.toLowerCase().includes(surname) &&
        (!year || b.year === year)
    );
    results.push({
      rawText: raw,
      format: raw.includes('et al.') ? 'et-al' : 'author-year',
      position: m.index,
      matchedBibEntry,
    });
  }

  // 4. Narrative "Author et al. (2021)" or "Author (2021)"
  const etAlRegex = /\b([A-Z][a-zA-Z'-]+(?:\s+et\s+al\.|\s+and\s+[A-Z][a-zA-Z'-]+)?\s*\((?:19|20)\d{2}[a-z]?\))/g;
  while ((m = etAlRegex.exec(bodyText)) !== null) {
    const raw = m[0];
    const prevChar = bodyText[m.index - 1];
    if (prevChar === '(') continue;
    const surname = m[1].split(/\s+/)[0].toLowerCase();
    const yearMatch = raw.match(/\b((?:19|20)\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : undefined;
    const matchedBibEntry = bibEntries.find(
      (b) =>
        b.rawText.toLowerCase().includes(surname) &&
        (!year || b.year === year)
    );
    results.push({
      rawText: raw,
      format: raw.includes('et al.') ? 'et-al' : 'author-year',
      position: m.index,
      matchedBibEntry,
    });
  }

  // 5. Inline DOIs
  const doiRegex = /\b(?:https?:\/\/doi\.org\/|doi:\s*)?(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/gi;
  while ((m = doiRegex.exec(bodyText)) !== null) {
    const doiClean = m[1].replace(/[.,;)]+$/, '');
    const matchedBibEntry = bibEntries.find(
      (b) => b.doi?.toLowerCase() === doiClean.toLowerCase()
    );
    results.push({
      rawText: m[0],
      format: 'doi',
      position: m.index,
      matchedBibEntry,
    });
  }

  return results.sort((a, b) => a.position - b.position);
}
