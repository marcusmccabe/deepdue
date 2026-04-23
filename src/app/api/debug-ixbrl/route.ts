import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const CH_BASE = "https://api.company-information.service.gov.uk";
const CH_DOC_BASE = "https://document-api.company-information.service.gov.uk";
const DEFAULT_COMPANY = "00445790";

function chAuth(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyNumber = (searchParams.get("company") ?? DEFAULT_COMPANY).toUpperCase();

  const log: string[] = [];
  const result: Record<string, unknown> = { log, companyNumber };

  // Step 1: fetch filing history
  log.push(`Fetching filing history for ${companyNumber}`);
  const historyUrl = `${CH_BASE}/company/${companyNumber}/filing-history?category=accounts&items_per_page=15`;
  log.push(`GET ${historyUrl}`);

  let filings: Array<{
    type?: string;
    date?: string;
    description?: string;
    description_values?: Record<string, string>;
    links?: { document_metadata?: string };
  }> = [];

  try {
    const histRes = await fetch(historyUrl, {
      headers: { Authorization: chAuth() },
      cache: "no-store",
    });
    log.push(`filing-history status=${histRes.status} content-type="${histRes.headers.get("content-type") ?? ""}"`);

    if (!histRes.ok) {
      result.error = `filing-history HTTP ${histRes.status}`;
      return NextResponse.json(result);
    }

    const histData = await histRes.json();
    filings = histData.items ?? [];
    log.push(`total filings returned: ${filings.length}`);
    const allTypes = filings.map((f) => f.type ?? "?").join(", ");
    log.push(`types: [${allTypes}]`);
  } catch (err) {
    result.error = `filing-history fetch threw: ${String(err)}`;
    return NextResponse.json(result);
  }

  // Step 2: find first accounts filing
  const ACCOUNT_TYPES = new Set(["AA", "AAMD"]);
  const firstAccounts = filings.find(
    (f) => ACCOUNT_TYPES.has(f.type ?? "") && f.links?.document_metadata
  );

  if (!firstAccounts) {
    log.push("No AA/AAMD filing with document_metadata found");
    result.firstFiling = null;
    return NextResponse.json(result);
  }

  const periodEnd =
    firstAccounts.description_values?.made_up_date ?? firstAccounts.date ?? "unknown";
  log.push(`First accounts filing: type=${firstAccounts.type} periodEnd=${periodEnd} description="${firstAccounts.description ?? ""}"`);
  log.push(`document_metadata URL: ${firstAccounts.links!.document_metadata}`);

  result.firstFiling = {
    type: firstAccounts.type,
    periodEnd,
    description: firstAccounts.description,
    metaUrl: firstAccounts.links!.document_metadata,
  };

  // Step 3: fetch the metadata document to see what formats/URLs are available
  const metaUrl = firstAccounts.links!.document_metadata!;
  log.push(`Fetching metadata: GET ${metaUrl}`);

  let docContentUrl: string | null = null;

  try {
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: chAuth(), Accept: "application/json" },
      cache: "no-store",
    });
    log.push(`metadata status=${metaRes.status} content-type="${metaRes.headers.get("content-type") ?? ""}"`);

    if (metaRes.ok) {
      const metaBody = await metaRes.json();
      result.metadataResponse = metaBody;
      log.push(`metadata body keys: ${Object.keys(metaBody).join(", ")}`);

      // CH Document API returns { links: { document: "..." }, resources: { ... } }
      const docLink = metaBody?.links?.document as string | undefined;
      const resources = metaBody?.resources as Record<string, { content_length?: number; links?: { document?: string } }> | undefined;

      // Always surface resources so callers can see what formats CH is offering
      if (resources) {
        const contentTypes = Object.keys(resources);
        const hasXhtml = contentTypes.some((k) => k.toLowerCase().includes("xhtml"));
        const hasPdf = contentTypes.some((k) => k.toLowerCase().includes("pdf"));
        result.resources = resources;
        result.resourcesContentTypes = contentTypes;
        result.resourcesHasXhtml = hasXhtml;
        result.resourcesHasPdf = hasPdf;
        result.resourcesFormatVerdict = !hasXhtml && hasPdf ? "pdf-only" : hasXhtml ? "ixbrl-available" : "unknown";
        log.push(`resources content-types: [${contentTypes.join(", ")}]`);
        log.push(`format verdict: ${result.resourcesFormatVerdict}`);
      } else {
        result.resources = null;
        log.push("metadata has no resources field");
      }

      if (docLink) {
        log.push(`links.document from metadata: ${docLink}`);
        docContentUrl = docLink;
      } else if (resources) {
        // Prefer XHTML, fall back to first available
        const xhtmlKey = Object.keys(resources).find((k) => k.toLowerCase().includes("xhtml"));
        const chosenKey = xhtmlKey ?? Object.keys(resources)[0];
        const chosenLink = resources[chosenKey]?.links?.document;
        if (chosenLink) {
          log.push(`chosen resource="${chosenKey}" links.document=${chosenLink}`);
          docContentUrl = chosenLink;
        }
      }

      // Also attempt the /content path derived from the metadata URL
      if (!docContentUrl) {
        const idMatch = metaUrl.match(/\/document\/([^/?#]+)/);
        if (idMatch) {
          docContentUrl = `${CH_DOC_BASE}/document/${idMatch[1]}/content`;
          log.push(`Falling back to derived content URL: ${docContentUrl}`);
        }
      }
    } else {
      const body = await metaRes.text();
      log.push(`metadata non-OK body (first 500 chars): ${body.slice(0, 500)}`);
      // Still try the /content path
      const idMatch = metaUrl.match(/\/document\/([^/?#]+)/);
      if (idMatch) {
        docContentUrl = `${CH_DOC_BASE}/document/${idMatch[1]}/content`;
        log.push(`Trying derived content URL anyway: ${docContentUrl}`);
      }
    }
  } catch (err) {
    log.push(`metadata fetch threw: ${String(err)}`);
    const idMatch = metaUrl.match(/\/document\/([^/?#]+)/);
    if (idMatch) {
      docContentUrl = `${CH_DOC_BASE}/document/${idMatch[1]}/content`;
      log.push(`Trying derived content URL after error: ${docContentUrl}`);
    }
  }

  if (!docContentUrl) {
    log.push("Could not determine document content URL");
    return NextResponse.json(result);
  }

  // Step 4: download the document
  log.push(`Downloading document: GET ${docContentUrl}`);
  result.docUrl = docContentUrl;

  try {
    const docRes = await fetch(docContentUrl, {
      headers: { Authorization: chAuth(), Accept: "application/xhtml+xml, text/html, application/xml, */*" },
      cache: "no-store",
    });

    const contentType = docRes.headers.get("content-type") ?? "";
    const contentLength = docRes.headers.get("content-length") ?? "unknown";
    log.push(`document status=${docRes.status} content-type="${contentType}" content-length=${contentLength}`);

    result.docStatus = docRes.status;
    result.docContentType = contentType;
    result.docContentLength = contentLength;

    if (!docRes.ok) {
      const errBody = await docRes.text();
      log.push(`non-OK body (first 500 chars): ${errBody.slice(0, 500)}`);
      result.docErrorBody = errBody.slice(0, 500);
      return NextResponse.json(result);
    }

    const buf = await docRes.arrayBuffer();
    const sizeMB = (buf.byteLength / 1024 / 1024).toFixed(2);
    log.push(`downloaded ${sizeMB} MB (${buf.byteLength} bytes)`);
    result.docActualBytes = buf.byteLength;

    const html = new TextDecoder("utf-8").decode(buf);

    // Step 5: collect first 30 unique name attribute values from nonFraction elements
    const nameSet = new Set<string>();
    const nameRe = /<\w+:nonFraction\b[^>]*\bname="([^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = nameRe.exec(html)) !== null && nameSet.size < 30) {
      nameSet.add(m[1]);
    }

    const allNamesRe = /<\w+:nonFraction\b[^>]*\bname="([^"]+)"/gi;
    let totalCount = 0;
    while ((m = allNamesRe.exec(html)) !== null) totalCount++;

    log.push(`nonFraction elements total: ${totalCount}`);
    log.push(`first 30 unique name values: ${[...nameSet].join(", ")}`);

    result.nonFractionTotal = totalCount;
    result.first30Names = [...nameSet];
    result.docPreview = html.slice(0, 500).replace(/\s+/g, " ");
  } catch (err) {
    log.push(`document download threw: ${String(err)}`);
    result.docError = String(err);
  }

  return NextResponse.json(result, { status: 200 });
}
