import { extractText } from 'unpdf';
import type {
  BibliographyEntry,
  CitationFlag,
  ResearchSourceRecord,
} from '../src/types.ts';

const USER_AGENT =
  'CiteVerify/1.0 (Academic Research Integrity Platform; mailto:research@citeverify.org)';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'were', 'was', 'are',
  'have', 'has', 'had', 'been', 'being', 'which', 'their', 'they', 'into',
  'than', 'then', 'over', 'under', 'after', 'before', 'between', 'during',
  'across', 'using', 'based', 'study', 'studies', 'paper', 'authors', 'showed',
  'demonstrated', 'established', 'found', 'reported', 'observed', 'results',
  'clinical', 'model', 'models', 'system', 'systems', 'method', 'methods',
  'also', 'more', 'most', 'only', 'such', 'other', 'about', 'through',
]);

export function reconstructOpenAlexAbstract(
  invertedIndex?: Record<string, number[]> | null
): string | undefined {
  if (!invertedIndex || typeof invertedIndex !== 'object') return undefined;
  const words: Array<{ pos: number; word: string }> = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (Array.isArray(positions)) {
      for (const pos of positions) {
        words.push({ pos, word });
      }
    }
  }
  if (words.length === 0) return undefined;
  words.sort((a, b) => a.pos - b.pos);
  return words.map((w) => w.word).join(' ').trim();
}

function stripJatsXml(xml?: string): string | undefined {
  if (!xml) return undefined;
  const cleaned = xml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 20 ? cleaned : undefined;
}

function stripHtmlOrXmlBody(raw: string): string | undefined {
  const withoutBoilerplate = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<(?:p|div|sec|section|h\d|li|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return withoutBoilerplate.length > 400 ? withoutBoilerplate : undefined;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { __httpError: res.status, __statusText: res.statusText };
    }
    return await res.json();
  } catch (err: any) {
    return { __fetchError: err?.message || 'Network request failed' };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenAccessFullText(
  candidateUrls: string[],
  pmcid?: string
): Promise<{
  fullText?: string;
  usedUrl?: string;
  sourceLabel?:
    | 'Open-Access Full Text (PDF)'
    | 'Open-Access Full Text (HTML/XML)'
    | 'Europe PMC Full Text';
}> {
  // 1. Europe PMC Open-Access fullTextXML is cleanest and fastest when PMCID is known
  if (pmcid) {
    const epmcXmlUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/${encodeURIComponent(
      pmcid
    )}/fullTextXML`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 26000);
    try {
      const res = await fetch(epmcXmlUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      if (res.ok) {
        const xmlText = await res.text();
        const cleaned = stripHtmlOrXmlBody(xmlText);
        if (cleaned && cleaned.length > 500) {
          return {
            fullText: cleaned.slice(0, 220000),
            usedUrl: `https://europepmc.org/article/PMC/${pmcid.replace(/^PMC/i, '')}`,
            sourceLabel: 'Europe PMC Full Text',
          };
        }
      }
    } catch {
      // Fall through to OA PDF/HTML URLs
    } finally {
      clearTimeout(timer);
    }
  }

  // 2. Try candidate Open-Access URLs from Unpaywall / OpenAlex
  const uniqueUrls = Array.from(
    new Set(candidateUrls.filter((u) => /^https?:\/\//i.test(u)))
  ).slice(0, 3);

  for (const url of uniqueUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/pdf,text/html,application/xhtml+xml,*/*',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!res.ok) continue;

      const contentLen = Number(res.headers.get('content-length') || 0);
      if (contentLen > 10 * 1024 * 1024) continue;

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 10 * 1024 * 1024 || buf.length < 300) continue;

      const isPdfMagic = buf.subarray(0, 4).toString('ascii') === '%PDF';
      if (contentType.includes('application/pdf') || isPdfMagic) {
        try {
          const parsed = await extractText(new Uint8Array(buf), {
            mergePages: true,
          });
          const raw = Array.isArray(parsed.text)
            ? parsed.text.join('\n')
            : String(parsed.text || '');
          const cleaned = raw
            .replace(/\r\n/g, '\n')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          if (cleaned.length > 500) {
            return {
              fullText: cleaned.slice(0, 220000),
              usedUrl: res.url || url,
              sourceLabel: 'Open-Access Full Text (PDF)',
            };
          }
        } catch {
          continue;
        }
      } else if (
        contentType.includes('text/html') ||
        contentType.includes('application/xhtml') ||
        contentType.includes('text/xml') ||
        contentType.includes('application/xml')
      ) {
        const html = buf.toString('utf-8');
        const cleaned = stripHtmlOrXmlBody(html);
        // Guard against bot-challenge / paywall stub pages
        if (
          cleaned &&
          cleaned.length > 800 &&
          !/enable javascript|access denied|cloudflare|just a moment/i.test(
            cleaned.slice(0, 500)
          )
        ) {
          return {
            fullText: cleaned.slice(0, 220000),
            usedUrl: res.url || url,
            sourceLabel: 'Open-Access Full Text (HTML/XML)',
          };
        }
      }
    } catch {
      // Try next candidate OA URL
    } finally {
      clearTimeout(timer);
    }
  }

  return {};
}

function normalizeDoi(doi?: string): string | undefined {
  if (!doi) return undefined;
  return doi
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
}

function titleSimilarity(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const tokA = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
  const tokB = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokA) {
    if (tokB.has(t)) overlap++;
  }
  return overlap / Math.max(tokA.size, tokB.size);
}

/**
 * Semantic chunking & scoring for Open-Access Full-Text bodies so claims
 * referencing Results/Methods tables outside the abstract are resolved accurately.
 */
export function retrieveRelevantChunksForClaim(
  claimText: string,
  fullTextBody?: string,
  abstractText?: string,
  basePassageSource: ResearchSourceRecord['passageSource'] = 'Unavailable'
): {
  combinedPremise: string;
  topChunks: string[];
  passageSource: ResearchSourceRecord['passageSource'];
} {
  if (!fullTextBody || fullTextBody.length < 400) {
    return {
      combinedPremise: abstractText || '',
      topChunks: [],
      passageSource: basePassageSource,
    };
  }

  // Extract claim keywords & numbers
  const claimWords = Array.from(
    new Set(
      claimText
        .toLowerCase()
        .replace(/[^a-z0-9.%-\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    )
  );
  const claimNumbers = Array.from(
    claimText.matchAll(/\d+(?:\.\d+)?%?/g),
    (m) => m[0].toLowerCase()
  );

  // Build overlapping ~260-word chunks with stride 180 words
  const words = fullTextBody.split(/\s+/);
  const chunks: string[] = [];
  const chunkSize = 260;
  const stride = 180;
  for (let i = 0; i < words.length; i += stride) {
    const slice = words.slice(i, i + chunkSize).join(' ').trim();
    if (slice.length > 80) chunks.push(slice);
    if (i + chunkSize >= words.length) break;
    if (chunks.length >= 60) break;
  }

  const scored = chunks.map((chunk, idx) => {
    const lower = chunk.toLowerCase();
    let score = 0;
    for (const kw of claimWords) {
      if (lower.includes(kw)) score += 2;
    }
    for (const num of claimNumbers) {
      if (lower.includes(num)) score += 4.5;
    }
    if (/\b(results|table|figure|observed|significantly|p\s*[<>=])\b/i.test(chunk)) {
      score += 1;
    }
    // Slight preference against trailing bibliography section of the referenced paper
    if (idx > chunks.length * 0.85 && /\bdoi:\s*10\./i.test(chunk)) {
      score -= 3;
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topChunks = scored
    .filter((s) => s.score > 0)
    .slice(0, 3)
    .map((s) => s.chunk);

  if (topChunks.length === 0) {
    topChunks.push(chunks[0] || fullTextBody.slice(0, 1500));
  }

  const combinedParts: string[] = [];
  if (abstractText) {
    combinedParts.push(`[ABSTRACT]\n${abstractText}`);
  }
  topChunks.forEach((ch, idx) => {
    combinedParts.push(`[FULL-TEXT CHUNK ${idx + 1}]\n${ch}`);
  });

  return {
    combinedPremise: combinedParts.join('\n\n').slice(0, 4800),
    topChunks,
    passageSource: basePassageSource,
  };
}

export async function lookupOriginalResearch(params: {
  doi?: string;
  title?: string;
  authors?: string[];
  year?: number;
  rawReference?: string;
}): Promise<{
  source: ResearchSourceRecord;
  flags: CitationFlag[];
  fullTextBody?: string;
}> {
  const flags: CitationFlag[] = [];
  const cleanDoi = normalizeDoi(params.doi);

  let openAlexWork: any = null;
  let crossrefWork: any = null;
  let unpaywallWork: any = null;
  let doiLookupFailed = false;

  // 1. Prioritize DOI resolution across OpenAlex, Crossref, and Unpaywall in parallel
  if (cleanDoi) {
    const [oaRes, crRes, upRes] = await Promise.all([
      fetchJsonWithTimeout(
        `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}`
      ),
      fetchJsonWithTimeout(
        `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`
      ),
      fetchJsonWithTimeout(
        `https://api.unpaywall.org/v2/${encodeURIComponent(
          cleanDoi
        )}?email=research@citeverify.org`,
        6500
      ),
    ]);

    if (oaRes && !oaRes.__httpError && !oaRes.__fetchError && oaRes.id) {
      openAlexWork = oaRes;
    }
    if (
      crRes &&
      !crRes.__httpError &&
      !crRes.__fetchError &&
      crRes.message?.DOI
    ) {
      crossrefWork = crRes.message;
    }
    if (upRes && !upRes.__httpError && !upRes.__fetchError && upRes.doi) {
      unpaywallWork = upRes;
    }

    if (!openAlexWork && !crossrefWork && !unpaywallWork) {
      doiLookupFailed = true;
      flags.push('Incorrect DOI');
    }
  }

  // 2. Fallback or cross-check by bibliographic search (title / author / year)
  const searchQuery =
    params.title ||
    params.rawReference
      ?.replace(/^(?:\[\d+\]|\(\d+\)|\d+\.)\s*/, '')
      .slice(0, 150);

  if ((!openAlexWork || !crossrefWork) && searchQuery && searchQuery.length > 8) {
    const queries: Promise<void>[] = [];

    if (!openAlexWork) {
      const oaUrl = `https://api.openalex.org/works?search=${encodeURIComponent(
        searchQuery
      )}&per-page=3`;
      queries.push(
        fetchJsonWithTimeout(oaUrl).then((data) => {
          const candidates = data?.results;
          if (Array.isArray(candidates) && candidates.length > 0) {
            const best = params.title
              ? candidates
                  .map((c: any) => ({
                    c,
                    sim: titleSimilarity(params.title, c.title),
                  }))
                  .sort((x: any, y: any) => y.sim - x.sim)[0]
              : { c: candidates[0], sim: 0.4 };
            if (best && best.sim >= 0.32) {
              openAlexWork = best.c;
            }
          }
        })
      );
    }

    if (!crossrefWork) {
      const crUrl = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(
        searchQuery
      )}&rows=3`;
      queries.push(
        fetchJsonWithTimeout(crUrl).then((data) => {
          const candidates = data?.message?.items;
          if (Array.isArray(candidates) && candidates.length > 0) {
            const best = params.title
              ? candidates
                  .map((c: any) => ({
                    c,
                    sim: titleSimilarity(
                      params.title,
                      Array.isArray(c.title) ? c.title[0] : c.title
                    ),
                  }))
                  .sort((x: any, y: any) => y.sim - x.sim)[0]
              : { c: candidates[0], sim: 0.4 };
            if (best && best.sim >= 0.32) {
              crossrefWork = best.c;
            }
          }
        })
      );
    }

    await Promise.all(queries);
  }

  // If DOI was resolved via Crossref/OpenAlex search, also resolve missing OpenAlex or Unpaywall by resolved DOI
  const discoveredDoi =
    normalizeDoi(openAlexWork?.doi) ||
    normalizeDoi(crossrefWork?.DOI) ||
    normalizeDoi(unpaywallWork?.doi) ||
    cleanDoi;

  if (discoveredDoi && (!openAlexWork || !unpaywallWork)) {
    const extraCalls: Promise<void>[] = [];
    if (!openAlexWork) {
      extraCalls.push(
        fetchJsonWithTimeout(
          `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(
            discoveredDoi
          )}`
        ).then((oaByDoi) => {
          if (
            oaByDoi &&
            !oaByDoi.__httpError &&
            !oaByDoi.__fetchError &&
            oaByDoi.id
          ) {
            openAlexWork = oaByDoi;
          }
        })
      );
    }
    if (!unpaywallWork) {
      extraCalls.push(
        fetchJsonWithTimeout(
          `https://api.unpaywall.org/v2/${encodeURIComponent(
            discoveredDoi
          )}?email=research@citeverify.org`,
          6000
        ).then((upByDoi) => {
          if (upByDoi && !upByDoi.__httpError && !upByDoi.__fetchError && upByDoi.doi) {
            unpaywallWork = upByDoi;
          }
        })
      );
    }
    await Promise.all(extraCalls);
  }

  const openAlexFound = Boolean(openAlexWork);
  const crossrefFound = Boolean(crossrefWork);
  const unpaywallFound = Boolean(unpaywallWork?.is_oa);
  const verified = openAlexFound || crossrefFound || Boolean(unpaywallWork);

  if (!verified) {
    if (!flags.includes('Incorrect DOI')) {
      flags.push('Missing Publication');
    }
    return {
      source: {
        verified: false,
        openAlexFound: false,
        crossrefFound: false,
        unpaywallFound: false,
        authors: params.authors || [],
        year: params.year,
        doi: cleanDoi,
        title: params.title,
        passageSource: 'Unavailable',
        retrievalNote: doiLookupFailed
          ? `DOI "${cleanDoi}" did not resolve in OpenAlex, Crossref, or Unpaywall.`
          : 'No matching publication record found in OpenAlex or Crossref.',
      },
      flags,
    };
  }

  const resolvedTitle =
    openAlexWork?.title ||
    (Array.isArray(crossrefWork?.title)
      ? crossrefWork.title[0]
      : crossrefWork?.title) ||
    unpaywallWork?.title ||
    params.title;

  const oaAuthors: string[] = Array.isArray(openAlexWork?.authorships)
    ? openAlexWork.authorships
        .map((a: any) => a?.author?.display_name)
        .filter(Boolean)
    : [];
  const crAuthors: string[] = Array.isArray(crossrefWork?.author)
    ? crossrefWork.author
        .map((a: any) => [a.given, a.family].filter(Boolean).join(' ').trim())
        .filter(Boolean)
    : [];
  const resolvedAuthors = oaAuthors.length > 0 ? oaAuthors : crAuthors;

  const oaYear = openAlexWork?.publication_year;
  const crYear =
    crossrefWork?.published?.['date-parts']?.[0]?.[0] ||
    crossrefWork?.['published-print']?.['date-parts']?.[0]?.[0] ||
    crossrefWork?.['published-online']?.['date-parts']?.[0]?.[0] ||
    unpaywallWork?.year;
  const resolvedYear: number | undefined = oaYear || crYear;

  const resolvedDoi = discoveredDoi;
  const resolvedJournal =
    openAlexWork?.primary_location?.source?.display_name ||
    (Array.isArray(crossrefWork?.['container-title'])
      ? crossrefWork['container-title'][0]
      : crossrefWork?.['container-title']) ||
    unpaywallWork?.journal_name;

  // Cross-check Author & Year against cited reference
  if (params.year && resolvedYear && Math.abs(params.year - resolvedYear) > 1) {
    flags.push('Year Mismatch');
  }

  if (
    params.authors &&
    params.authors.length > 0 &&
    resolvedAuthors.length > 0
  ) {
    const citedSurnames = params.authors
      .map((a) => a.split(/[\s,]+/).pop()?.toLowerCase() || a.toLowerCase())
      .filter((s) => s.length > 2);
    const resolvedJoined = resolvedAuthors.join(' ').toLowerCase();
    const anyAuthorMatches = citedSurnames.some((s) =>
      resolvedJoined.includes(s)
    );
    if (citedSurnames.length > 0 && !anyAuthorMatches) {
      flags.push('Author Mismatch');
    }
  }

  // Abstract + PMCID retrieval
  const oaAbstract = reconstructOpenAlexAbstract(
    openAlexWork?.abstract_inverted_index
  );
  const crAbstract = stripJatsXml(crossrefWork?.abstract);

  let epmcAbstract: string | undefined;
  let pmcid: string | undefined;
  let s2PdfUrl: string | undefined;
  let fallbackSourceLabel:
    | 'Europe PMC Abstract'
    | 'Semantic Scholar Abstract'
    | undefined;

  async function fetchPubMedAbstractAndPmcid(doi: string): Promise<{
    abstract?: string;
    pmcid?: string;
  }> {
    try {
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(
        `${doi}[DOI]`
      )}&retmode=json`;
      let sJson = await fetchJsonWithTimeout(searchUrl, 6000);
      if (sJson?.__httpError === 429) {
        await new Promise((r) => setTimeout(r, 650));
        sJson = await fetchJsonWithTimeout(searchUrl, 6000);
      }
      const pmid = sJson?.esearchresult?.idlist?.[0];
      if (!pmid) return {};

      const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${encodeURIComponent(
        pmid
      )}&retmode=xml`;

      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 650));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        try {
          const res = await fetch(efetchUrl, {
            headers: { 'User-Agent': USER_AGENT },
            signal: controller.signal,
          });
          if (res.status === 429) continue;
          if (!res.ok) return {};
          const xml = await res.text();
          const pmcMatch = xml.match(
            /<ArticleId IdType="pmc">(PMC\d+)<\/ArticleId>/
          );
          const absParts = Array.from(
            xml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g),
            (m) => stripJatsXml(m[1])
          ).filter(Boolean);
          return {
            pmcid: pmcMatch?.[1],
            abstract: absParts.length > 0 ? absParts.join(' ') : undefined,
          };
        } finally {
          clearTimeout(timer);
        }
      }
      return {};
    } catch {
      return {};
    }
  }

  if (resolvedDoi) {
    // Query PubMed E-utilities (1.5s for abstract + PMCID) + Semantic Scholar in parallel; fall back to Europe PMC search if needed
    const [pubmedRes, s2Res] = await Promise.all([
      fetchPubMedAbstractAndPmcid(resolvedDoi),
      !oaAbstract && !crAbstract
        ? fetchJsonWithTimeout(
            `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(
              resolvedDoi
            )}?fields=title,abstract,openAccessPdf`,
            5000
          )
        : Promise.resolve(null),
    ]);

    if (pubmedRes.pmcid) {
      pmcid = pubmedRes.pmcid;
    }
    if (s2Res?.openAccessPdf?.url) {
      s2PdfUrl = s2Res.openAccessPdf.url;
    }
    if (s2Res?.abstract) {
      epmcAbstract = stripJatsXml(s2Res.abstract);
      fallbackSourceLabel = 'Semantic Scholar Abstract';
    }
    if (pubmedRes.abstract) {
      epmcAbstract = pubmedRes.abstract;
      fallbackSourceLabel = 'Europe PMC Abstract';
    }

    // Fallback to Europe PMC search only if neither PMCID nor fallback abstract was obtained yet
    if (!pmcid && !oaAbstract && !crAbstract && !epmcAbstract) {
      const epmcRes = await fetchJsonWithTimeout(
        `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(
          resolvedDoi
        )}&resultType=core&format=json`,
        18000
      );
      const firstResult = epmcRes?.resultList?.result?.[0];
      if (firstResult?.pmcid) pmcid = firstResult.pmcid;
      if (firstResult?.abstractText) {
        epmcAbstract = stripJatsXml(firstResult.abstractText);
        fallbackSourceLabel = 'Europe PMC Abstract';
      }
    }
  }

  const abstractText = oaAbstract || crAbstract || epmcAbstract;

  // Collect Open-Access Full-Text URLs from Unpaywall, OpenAlex, and Semantic Scholar
  const oaCandidateUrls: string[] = [];
  if (s2PdfUrl) oaCandidateUrls.push(s2PdfUrl);
  if (unpaywallWork?.best_oa_location?.url_for_pdf) {
    oaCandidateUrls.push(unpaywallWork.best_oa_location.url_for_pdf);
  }
  if (Array.isArray(unpaywallWork?.oa_locations)) {
    for (const loc of unpaywallWork.oa_locations) {
      if (loc?.url_for_pdf) oaCandidateUrls.push(loc.url_for_pdf);
      if (loc?.url_for_landing_page) oaCandidateUrls.push(loc.url_for_landing_page);
    }
  }
  if (openAlexWork?.best_oa_location?.pdf_url) {
    oaCandidateUrls.push(openAlexWork.best_oa_location.pdf_url);
  }
  if (openAlexWork?.open_access?.oa_url) {
    oaCandidateUrls.push(openAlexWork.open_access.oa_url);
  }
  if (openAlexWork?.primary_location?.pdf_url) {
    oaCandidateUrls.push(openAlexWork.primary_location.pdf_url);
  }
  if (unpaywallWork?.best_oa_location?.url) {
    oaCandidateUrls.push(unpaywallWork.best_oa_location.url);
  }

  // Fetch genuine Open-Access Full Text if OA URL or PMCID is available
  let fullTextBody: string | undefined;
  let fullTextUsedUrl: string | undefined;
  let fullTextSourceLabel:
    | 'Open-Access Full Text (PDF)'
    | 'Open-Access Full Text (HTML/XML)'
    | 'Europe PMC Full Text'
    | undefined;

  if (pmcid || oaCandidateUrls.length > 0) {
    const ft = await fetchOpenAccessFullText(oaCandidateUrls, pmcid);
    if (ft.fullText) {
      fullTextBody = ft.fullText;
      fullTextUsedUrl = ft.usedUrl;
      fullTextSourceLabel = ft.sourceLabel;
    }
  }

  const openAccessUrl =
    fullTextUsedUrl ||
    oaCandidateUrls[0] ||
    openAlexWork?.open_access?.oa_url;

  const sourceUrl =
    openAccessUrl ||
    openAlexWork?.primary_location?.landing_page_url ||
    (resolvedDoi ? `https://doi.org/${resolvedDoi}` : undefined) ||
    openAlexWork?.id;

  const passageSource: ResearchSourceRecord['passageSource'] =
    fullTextSourceLabel ||
    (oaAbstract
      ? 'OpenAlex Abstract'
      : crAbstract
      ? 'Crossref Abstract'
      : epmcAbstract && fallbackSourceLabel
      ? fallbackSourceLabel
      : 'Unavailable');

  return {
    source: {
      verified: true,
      openAlexFound,
      crossrefFound,
      unpaywallFound,
      openAlexId: openAlexWork?.id,
      title: resolvedTitle,
      authors: resolvedAuthors,
      year: resolvedYear,
      doi: resolvedDoi,
      journal: resolvedJournal,
      sourceUrl,
      openAccessUrl,
      fullTextRetrieved: Boolean(fullTextBody),
      abstractText,
      relevantPassage:
        abstractText ||
        (fullTextBody ? fullTextBody.slice(0, 1200) : undefined),
      passageSource,
      citedByCount: openAlexWork?.cited_by_count,
      retrievalNote: fullTextBody
        ? `Retrieved Open-Access full-text body (${fullTextBody.length.toLocaleString()} chars) via ${passageSource}${
            abstractText ? ' alongside abstract.' : '.'
          }`
        : abstractText
        ? `Retrieved genuine abstract text from ${passageSource}.`
        : 'Publication metadata verified, but OpenAlex, Crossref, Unpaywall, and Europe PMC do not expose an open abstract or open-access full text for this record.',
    },
    flags,
    fullTextBody,
  };
}

export function extractQueryHintsFromBib(
  bib?: BibliographyEntry,
  rawCitation?: string
): { doi?: string; title?: string; authors?: string[]; year?: number } {
  if (bib) {
    return {
      doi: bib.doi,
      title: bib.title,
      authors: bib.authors,
      year: bib.year,
    };
  }
  const doiMatch = rawCitation?.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/);
  const yearMatch = rawCitation?.match(/\b((?:19|20)\d{2})\b/);
  const authorMatch = rawCitation?.match(/([A-Z][a-zA-Z'-]+)/);
  return {
    doi: doiMatch ? doiMatch[1] : undefined,
    authors: authorMatch ? [authorMatch[1]] : undefined,
    year: yearMatch ? Number(yearMatch[1]) : undefined,
  };
}
