import { NextRequest, NextResponse } from "next/server";
import type { FinancialYear, FinancialSnapshot } from "@/lib/financial-snapshot-types";

export const maxDuration = 30;

const CH_BASE = "https://api.company-information.service.gov.uk";
const CH_DOC_BASE = "https://document-api.company-information.service.gov.uk";
const MAX_DOC_BYTES = 30 * 1024 * 1024;
const CACHE_TTL = 86_400_000; // 24 h — only for successful results
const EMPTY_CACHE_TTL = 5 * 60 * 1000; // 5 min — for no-data results (avoids hammering CH)

const cache = new Map<string, { data: FinancialSnapshot; ts: number; ttl: number }>();

function chAuth(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

// ── Concept name suffixes (without namespace prefix) ────────────────────────
// Ordered by likelihood — first match wins.
const TURNOVER_CONCEPTS = [
  "TurnoverRevenue",
  "Turnover",
  "Revenue",
  "TurnoverGrossProfit",
  "RevenueFromContractsWithCustomers",
  "GrossRevenue",
  "NetRevenue",
];
const OP_PROFIT_CONCEPTS = [
  "OperatingProfitLoss",
  "OperatingProfit",
  "ProfitLossFromOperatingActivities",
  "ProfitLossFromOperations",
  "ProfitLossBeforeInterestTaxDepreciationAmortisation",
  "ProfitBeforeInterestAndTaxation",
];
const NET_ASSETS_CONCEPTS = [
  "NetAssetsLiabilities",
  "NetAssets",
  "TotalEquity",
  "Equity",
  "ShareholdersEquity",
  "NetAssetsLiabilities1",
  "EquityAttributableToOwnersOfParent",
];
const CASH_CONCEPTS = [
  "CashBankInHand",
  "Cash",
  "CashAndCashEquivalents",
  "CashCashEquivalents",
  "CashAndBankBalances",
  "CashAtBankAndInHand",
  "CashInHand",
];
const LIABILITIES_CONCEPTS = [
  "Liabilities",
  "TotalLiabilities",
  "LiabilitiesTotal",
  "Creditors",
  "TotalCreditors",
  "TotalCurrentLiabilities",
  "CurrentLiabilities",
  "CreditorsAmountsFallingDueWithinOneYear",
];

// ── iXBRL parsing helpers ───────────────────────────────────────────────────

/**
 * Finds context IDs in the iXBRL that correspond to a specific period-end date.
 * Returns { period, instant } where:
 *   - period  = xbrli:context with an endDate matching targetDate (P&L items)
 *   - instant = xbrli:context with an instant matching targetDate (balance sheet items)
 *
 * Prefers contexts without a segment/scenario element (i.e. the consolidated
 * entity-level context) over dimensional/segment contexts, which is critical
 * for IFRS filers like large PLCs that tag segment data in the same document.
 */
function findContexts(
  html: string,
  targetDate: string,
  tag: string
): { period: string | null; instant: string | null } {
  const periodCandidates: Array<{ id: string; hasSegment: boolean }> = [];
  const instantCandidates: Array<{ id: string; hasSegment: boolean }> = [];
  const allDates = new Set<string>();

  // Handles both "xbrli:context" and plain "context" element names
  const contextRe =
    /<(?:[a-z]+:)?context\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[a-z]+:)?context>/gi;
  let m: RegExpExecArray | null;

  while ((m = contextRe.exec(html)) !== null) {
    const [, id, body] = m;
    // Segment or scenario qualifier → dimensional/member context, not entity-level
    const hasSegment = /<(?:[a-z]+:)?(?:segment|scenario)\b/i.test(body);

    const endM = body.match(
      /<(?:[a-z]+:)?endDate>\s*([^\s<]+)\s*<\/(?:[a-z]+:)?endDate>/i
    );
    if (endM) {
      allDates.add(endM[1].trim());
      if (endM[1].trim() === targetDate) {
        periodCandidates.push({ id, hasSegment });
      }
    }

    const instM = body.match(
      /<(?:[a-z]+:)?instant>\s*([^\s<]+)\s*<\/(?:[a-z]+:)?instant>/i
    );
    if (instM) {
      allDates.add(instM[1].trim());
      if (instM[1].trim() === targetDate) {
        instantCandidates.push({ id, hasSegment });
      }
    }
  }

  const period =
    (periodCandidates.find((c) => !c.hasSegment) ?? periodCandidates[0])?.id ??
    null;
  const instant =
    (instantCandidates.find((c) => !c.hasSegment) ?? instantCandidates[0])
      ?.id ?? null;

  if (!period && !instant && allDates.size > 0) {
    // targetDate doesn't match any context — log sample dates to help diagnose
    const sample = [...allDates].slice(0, 10).join(", ");
    console.log(
      `${tag} WARN: targetDate=${targetDate} matched no contexts. Sample dates in doc: ${sample}`
    );
  }

  return { period, instant };
}

/**
 * Extracts the first matching financial concept from the iXBRL.
 * If ctxRef is provided, only returns a value where contextRef matches.
 * Falls back to the first occurrence if ctxRef is null.
 *
 * Handles any namespace prefix on nonFraction (e.g. ix:, ix2:) via backreference.
 */
function extractConcept(
  html: string,
  ctxRef: string | null,
  concepts: string[]
): number | null {
  for (const concept of concepts) {
    const conceptLower = concept.toLowerCase();

    // \1 backreference ensures closing tag uses the same prefix as opening tag
    const re = /<(\w+):nonFraction\b([^>]*)>([\s\S]*?)<\/\1:nonFraction>/gi;
    let m: RegExpExecArray | null;

    while ((m = re.exec(html)) !== null) {
      const [, , attrs, rawContent] = m;

      // Concept name match (any namespace prefix, case-insensitive)
      const nameM = attrs.match(/\bname="[^:]+:([^"]+)"/i);
      if (!nameM || nameM[1].toLowerCase() !== conceptLower) continue;

      // Context filter
      if (ctxRef !== null) {
        const ctxM = attrs.match(/\bcontextRef="([^"]+)"/i);
        if (!ctxM || ctxM[1] !== ctxRef) continue;
      }

      // Scale (multiply displayed value by 10^scale to get actual)
      const scaleM = attrs.match(/\bscale="(-?\d+)"/i);
      const scale = scaleM ? parseInt(scaleM[1], 10) : 0;

      // Sign inversion (sign="-" means the positive display represents a negative value)
      const signM = attrs.match(/\bsign="([-+])"/i);
      const negate = signM?.[1] === "-";

      // Strip nested HTML tags and various whitespace/number-formatting characters
      const stripped = rawContent
        .replace(/<[^>]+>/g, "")
        .replace(/[\s,   ]/g, "");

      if (!stripped || stripped === "-" || stripped === "—") continue;

      const num = parseFloat(stripped);
      if (isNaN(num)) continue;

      let val = num * Math.pow(10, scale);
      if (negate) val = -val;
      return val;
    }
  }
  return null;
}

async function fetchAndParseIxbrl(
  docId: string,
  periodEnd: string,
  companyNumber: string
): Promise<Omit<FinancialYear, "periodEnd" | "year">> {
  const tag = `[ixbrl:${companyNumber}:${docId.slice(0, 8)}]`;
  const empty = {
    turnover: null,
    operatingProfit: null,
    netAssets: null,
    cashAtBank: null,
    totalLiabilities: null,
    hasData: false,
  };

  try {
    const url = `${CH_DOC_BASE}/document/${docId}/content`;
    console.log(`${tag} fetching ${url} (periodEnd=${periodEnd})`);

    const res = await fetch(url, {
      headers: { Authorization: chAuth(), Accept: "application/xhtml+xml" },
      cache: "no-store",
    });

    const ct = res.headers.get("content-type") ?? "";
    const clHeader = res.headers.get("content-length") ?? "unknown";
    console.log(
      `${tag} response status=${res.status} content-type="${ct}" content-length=${clHeader}`
    );

    if (!res.ok) {
      console.log(`${tag} non-OK response, returning empty`);
      return empty;
    }

    const isPdf = ct.includes("pdf");
    const isZip = ct.includes("zip") || ct.includes("octet-stream");
    // Accept xhtml, xml, xbrl, and plain html — iXBRL 1.1 may be served as text/html
    const isIxbrl =
      ct.includes("xhtml") ||
      ct.includes("xml") ||
      ct.includes("xbrl") ||
      ct.includes("html");

    console.log(
      `${tag} content-type flags: isPdf=${isPdf} isZip=${isZip} isIxbrl=${isIxbrl}`
    );

    if (!isIxbrl) {
      console.log(
        `${tag} not recognised as iXBRL (pdf=${isPdf} zip=${isZip}), skipping`
      );
      await res.body?.cancel();
      return empty;
    }

    const buf = await res.arrayBuffer();
    const sizeMB = (buf.byteLength / 1024 / 1024).toFixed(2);
    console.log(`${tag} downloaded ${sizeMB} MB (${buf.byteLength} bytes)`);

    if (buf.byteLength > MAX_DOC_BYTES) {
      console.log(
        `${tag} document exceeds ${MAX_DOC_BYTES / 1024 / 1024} MB limit, skipping`
      );
      return empty;
    }

    const html = new TextDecoder("utf-8").decode(buf);

    // Count nonFraction elements (any namespace prefix) for diagnostics
    const nonFractionCount = (html.match(/<\w+:nonFraction\b/gi) ?? []).length;
    console.log(`${tag} nonFraction elements found: ${nonFractionCount}`);

    if (nonFractionCount === 0) {
      // Log a sample of the document start to help diagnose
      const peek = html.slice(0, 300).replace(/\s+/g, " ");
      console.log(
        `${tag} WARN: zero nonFraction elements. Document preview: ${peek}`
      );
      return empty;
    }

    // Log sample concept names present in the document
    const allConceptNames = new Set<string>();
    const conceptSampleRe = /<\w+:nonFraction\b[^>]*\bname="([^"]+)"/gi;
    let cm: RegExpExecArray | null;
    while ((cm = conceptSampleRe.exec(html)) !== null) {
      allConceptNames.add(cm[1]);
    }
    console.log(
      `${tag} unique concept names (${allConceptNames.size} total), sample: ${[...allConceptNames].slice(0, 20).join(", ")}`
    );

    const { period: periodCtx, instant: instantCtx } = findContexts(
      html,
      periodEnd,
      tag
    );
    console.log(
      `${tag} contexts for ${periodEnd}: periodCtx=${periodCtx} instantCtx=${instantCtx}`
    );

    // P&L figures use period (duration) context; balance-sheet uses instant context
    const turnover = extractConcept(html, periodCtx, TURNOVER_CONCEPTS);
    const operatingProfit = extractConcept(html, periodCtx, OP_PROFIT_CONCEPTS);
    const netAssets = extractConcept(html, instantCtx, NET_ASSETS_CONCEPTS);
    const cashAtBank = extractConcept(html, instantCtx, CASH_CONCEPTS);
    const totalLiabilities = extractConcept(
      html,
      instantCtx,
      LIABILITIES_CONCEPTS
    );

    // Fall back to first-match (no context filter) if context-scoped search
    // returned nothing — handles edge cases where the entity-level context ID
    // doesn't match the tagging convention used for a particular concept.
    const result = {
      turnover: turnover ?? extractConcept(html, null, TURNOVER_CONCEPTS),
      operatingProfit:
        operatingProfit ?? extractConcept(html, null, OP_PROFIT_CONCEPTS),
      netAssets: netAssets ?? extractConcept(html, null, NET_ASSETS_CONCEPTS),
      cashAtBank: cashAtBank ?? extractConcept(html, null, CASH_CONCEPTS),
      totalLiabilities:
        totalLiabilities ?? extractConcept(html, null, LIABILITIES_CONCEPTS),
    };

    console.log(
      `${tag} extracted: turnover=${result.turnover} opProfit=${result.operatingProfit} netAssets=${result.netAssets} cash=${result.cashAtBank} liabilities=${result.totalLiabilities}`
    );

    const hasData = Object.values(result).some((v) => v !== null);
    return { ...result, hasData };
  } catch (err) {
    console.error(`${tag} unhandled error:`, err);
    return empty;
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

/**
 * GET /api/financial-snapshot?companyNumber=12345678
 *
 * Fetches up to 3 years of structured financial figures from iXBRL-tagged
 * annual accounts filed at Companies House.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyNumber = searchParams.get("companyNumber")?.toUpperCase();
  const nocache = searchParams.get("nocache") === "1";

  if (!companyNumber) {
    return NextResponse.json(
      { error: "Missing companyNumber" },
      { status: 400 }
    );
  }

  // Cache check (skip if ?nocache=1 is present)
  const hit = cache.get(companyNumber);
  if (!nocache && hit && Date.now() - hit.ts < hit.ttl) {
    const ageMin = Math.round((Date.now() - hit.ts) / 60_000);
    console.log(
      `[ixbrl] ${companyNumber} cache HIT (age=${ageMin}min, hasData=${hit.data.years.some((y) => y.hasData)})`
    );
    return NextResponse.json({ ...hit.data, cached: true });
  }

  console.log(
    `[ixbrl] ${companyNumber} cache miss${nocache ? " (nocache=1)" : ""} — fetching filing history`
  );

  // Fetch accounts filing history
  let filings: Array<{
    type?: string;
    date?: string;
    description_values?: Record<string, string>;
    links?: { document_metadata?: string };
  }>;

  try {
    const res = await fetch(
      `${CH_BASE}/company/${companyNumber}/filing-history?category=accounts&items_per_page=15`,
      { headers: { Authorization: chAuth() }, cache: "no-store" }
    );
    if (!res.ok) {
      console.error(
        `[ixbrl] ${companyNumber} filing history returned ${res.status}`
      );
      return NextResponse.json(
        { error: `Filing history ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    filings = data.items ?? [];
  } catch (err) {
    console.error(`[ixbrl] ${companyNumber} network error fetching filing history:`, err);
    return NextResponse.json({ error: "Network error" }, { status: 502 });
  }

  const allTypes = [...new Set(filings.map((f) => f.type ?? "?"))].join(", ");
  console.log(
    `[ixbrl] ${companyNumber} filing history: total=${filings.length} types=[${allTypes}]`
  );

  // Filter: full accounts (AA) or amended full accounts (AAMD) with document links
  const ACCOUNT_TYPES = new Set(["AA", "AAMD"]);
  const candidates = filings
    .filter((f) => ACCOUNT_TYPES.has(f.type ?? "") && f.links?.document_metadata)
    .slice(0, 3);

  console.log(
    `[ixbrl] ${companyNumber} AA/AAMD candidates with document links: ${candidates.length}`
  );
  candidates.forEach((f, i) => {
    const periodEnd = f.description_values?.made_up_date ?? f.date ?? "?";
    console.log(
      `[ixbrl] ${companyNumber} candidate[${i}]: type=${f.type} periodEnd=${periodEnd} metaUrl=${f.links?.document_metadata}`
    );
  });

  if (candidates.length === 0) {
    console.log(
      `[ixbrl] ${companyNumber} no AA/AAMD candidates — returning empty snapshot`
    );
  }

  // Download & parse each filing in parallel
  const settled = await Promise.allSettled(
    candidates.map(async (filing): Promise<FinancialYear> => {
      const periodEnd =
        filing.description_values?.made_up_date ?? filing.date ?? "";
      const year = periodEnd.substring(0, 4);

      const metaUrl = filing.links!.document_metadata!;
      const idMatch = metaUrl.match(/\/document\/([^/?]+)/);
      if (!idMatch) {
        console.log(
          `[ixbrl] ${companyNumber} could not extract docId from metaUrl=${metaUrl}`
        );
        return {
          periodEnd,
          year,
          turnover: null,
          operatingProfit: null,
          netAssets: null,
          cashAtBank: null,
          totalLiabilities: null,
          hasData: false,
        };
      }

      const docId = idMatch[1];
      const figures = await fetchAndParseIxbrl(docId, periodEnd, companyNumber);
      return { periodEnd, year, ...figures };
    })
  );

  const years: FinancialYear[] = settled
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<FinancialYear>).value);

  const hasAnyData = years.some((y) => y.hasData);
  console.log(
    `[ixbrl] ${companyNumber} parse complete: ${years.length} years, hasAnyData=${hasAnyData}`
  );

  const snapshot: FinancialSnapshot = {
    companyNumber,
    years,
    fetchedAt: new Date().toISOString(),
    source: hasAnyData ? "ixbrl" : "none",
  };

  // Only cache for 24 h when we got data; use 5-min TTL for empty results to
  // avoid hammering the CH API while still allowing retries.
  const ttl = hasAnyData ? CACHE_TTL : EMPTY_CACHE_TTL;
  cache.set(companyNumber, { data: snapshot, ts: Date.now(), ttl });

  return NextResponse.json(snapshot);
}
