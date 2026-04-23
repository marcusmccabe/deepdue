/**
 * Diagnostic script: probe Companies House API for Tesco iXBRL accounts.
 * Run with:  COMPANIES_HOUSE_API_KEY=xxx node scripts/test-tesco-ixbrl.mjs
 */

const CH_BASE = "https://api.company-information.service.gov.uk";
const CH_DOC_BASE = "https://document-api.company-information.service.gov.uk";
const TESCO_NUMBER = "00445790";

const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
if (!key) {
  console.error("ERROR: Set COMPANIES_HOUSE_API_KEY environment variable first.");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${key}:`).toString("base64");

async function main() {
  // ── Step 1: fetch filing history ─────────────────────────────────────────
  console.log("\n=== Step 1: Filing history ===");
  const histUrl = `${CH_BASE}/company/${TESCO_NUMBER}/filing-history?category=accounts&items_per_page=20`;
  console.log("GET", histUrl);
  const histRes = await fetch(histUrl, { headers: { Authorization: auth } });
  console.log("Status:", histRes.status, histRes.statusText);

  if (!histRes.ok) {
    console.error("Failed to fetch filing history");
    process.exit(1);
  }

  const histData = await histRes.json();
  const filings = histData.items ?? [];
  console.log(`Total items returned: ${filings.length}`);
  console.log("Filing types found:", [...new Set(filings.map((f) => f.type))].join(", "));

  // Show first 5 filings
  filings.slice(0, 5).forEach((f, i) => {
    console.log(`\n  [${i}] type=${f.type} date=${f.date}`);
    console.log(`       description_values:`, JSON.stringify(f.description_values));
    console.log(`       links.document_metadata:`, f.links?.document_metadata);
  });

  // ── Step 2: find an AA/AAMD filing ──────────────────────────────────────
  console.log("\n=== Step 2: Filter AA/AAMD filings ===");
  const ACCOUNT_TYPES = new Set(["AA", "AAMD"]);
  const candidates = filings.filter(
    (f) => ACCOUNT_TYPES.has(f.type ?? "") && f.links?.document_metadata
  );
  console.log(`Found ${candidates.length} AA/AAMD filings with document_metadata links`);

  if (candidates.length === 0) {
    console.error("No candidates found — check type filter or filing list");
    process.exit(1);
  }

  const filing = candidates[0];
  const periodEnd =
    filing.description_values?.made_up_date ?? filing.date ?? "";
  console.log(`\nMost recent: type=${filing.type} periodEnd=${periodEnd}`);
  console.log(`document_metadata URL: ${filing.links.document_metadata}`);

  // ── Step 3: extract document ID ─────────────────────────────────────────
  console.log("\n=== Step 3: Extract document ID ===");
  const metaUrl = filing.links.document_metadata;
  const idMatch = metaUrl.match(/\/document\/([^/?]+)/);
  if (!idMatch) {
    console.error("Could not extract document ID from:", metaUrl);
    process.exit(1);
  }
  const docId = idMatch[1];
  console.log("Extracted document ID:", docId);

  // ── Step 4: fetch document metadata (JSON) ───────────────────────────────
  console.log("\n=== Step 4: Document metadata (JSON) ===");
  const metaFetchUrl = `${CH_DOC_BASE}/document/${docId}`;
  console.log("GET", metaFetchUrl, "(Accept: application/json)");
  const metaDocRes = await fetch(metaFetchUrl, {
    headers: { Authorization: auth, Accept: "application/json" },
  });
  console.log("Status:", metaDocRes.status, metaDocRes.statusText);
  if (metaDocRes.ok) {
    const metaDoc = await metaDocRes.json();
    console.log("Document metadata:", JSON.stringify(metaDoc, null, 2));
  }

  // ── Step 5: attempt to fetch iXBRL content ───────────────────────────────
  console.log("\n=== Step 5: Fetch iXBRL content ===");
  const contentUrl = `${CH_DOC_BASE}/document/${docId}/content`;
  console.log("GET", contentUrl, "(Accept: application/xhtml+xml)");
  const contentRes = await fetch(contentUrl, {
    headers: { Authorization: auth, Accept: "application/xhtml+xml" },
  });
  console.log("Status:", contentRes.status, contentRes.statusText);
  console.log("Content-Type:", contentRes.headers.get("content-type"));
  console.log("Content-Length:", contentRes.headers.get("content-length"));

  if (!contentRes.ok) {
    console.error("Failed to fetch content — status:", contentRes.status);
    // Try without /content suffix
    console.log("\n=== Step 5b: Retry without /content suffix ===");
    const url2 = `${CH_DOC_BASE}/document/${docId}`;
    console.log("GET", url2, "(Accept: application/xhtml+xml)");
    const res2 = await fetch(url2, {
      headers: { Authorization: auth, Accept: "application/xhtml+xml" },
    });
    console.log("Status:", res2.status, res2.statusText);
    console.log("Content-Type:", res2.headers.get("content-type"));
    console.log("Content-Length:", res2.headers.get("content-length"));
    if (!res2.ok) {
      process.exit(1);
    }
    // Use res2 for further analysis
    await analyseContent(res2, periodEnd);
    return;
  }

  await analyseContent(contentRes, periodEnd);
}

async function analyseContent(res, periodEnd) {
  // ── Step 6: analyse what we got ─────────────────────────────────────────
  console.log("\n=== Step 6: Analyse content ===");
  const ct = res.headers.get("content-type") ?? "";
  console.log("Content-Type:", ct);

  const isIxbrl = ct.includes("xhtml") || ct.includes("xml") || ct.includes("xbrl");
  const isPdf = ct.includes("pdf");
  const isZip = ct.includes("zip");
  console.log(`isIxbrl=${isIxbrl} isPdf=${isPdf} isZip=${isZip}`);

  const buf = await res.arrayBuffer();
  const sizeKB = Math.round(buf.byteLength / 1024);
  const sizeMB = (buf.byteLength / (1024 * 1024)).toFixed(2);
  console.log(`Response size: ${sizeKB} KB (${sizeMB} MB)`);
  console.log(`Exceeds 6MB limit: ${buf.byteLength > 6 * 1024 * 1024}`);
  console.log(`Exceeds 20MB limit: ${buf.byteLength > 20 * 1024 * 1024}`);

  if (!isIxbrl) {
    console.error("DIAGNOSIS: Content is not iXBRL — content-type check would reject it.");
    // Peek at first bytes
    const peek = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 200));
    console.log("First 200 chars:", peek);
    return;
  }

  const html = new TextDecoder("utf-8").decode(buf);

  // ── Step 7: check for ix:nonFraction elements ─────────────────────────
  console.log("\n=== Step 7: iXBRL elements ===");
  const nonFractionCount = (html.match(/<ix:nonFraction\b/gi) ?? []).length;
  console.log(`ix:nonFraction count: ${nonFractionCount}`);

  if (nonFractionCount === 0) {
    // Check for other nonFraction patterns (different namespace prefix)
    const altCount = (html.match(/<\w+:nonFraction\b/gi) ?? []).length;
    console.log(`Other :nonFraction prefixes count: ${altCount}`);
    const altMatches = html.match(/<(\w+):nonFraction\b/gi)?.slice(0, 5) ?? [];
    console.log("Sample:", altMatches);
    console.log("DIAGNOSIS: No ix:nonFraction elements found — namespace prefix may differ.");
    return;
  }

  // ── Step 8: sample concept names ─────────────────────────────────────
  console.log("\n=== Step 8: Sample concept names ===");
  const nameRe = /name="([^"]+)"/gi;
  const allNames = new Set();
  const re = /<ix:nonFraction\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const nameM = m[1].match(/\bname="([^"]+)"/i);
    if (nameM) allNames.add(nameM[1]);
  }
  console.log(`Unique concept names (${allNames.size} total):`);
  [...allNames].slice(0, 40).forEach((n) => console.log("  ", n));

  // ── Step 9: check context matching ───────────────────────────────────
  console.log("\n=== Step 9: Context matching ===");
  console.log(`Looking for periodEnd: ${periodEnd}`);
  const contextRe =
    /<(?:[a-z]+:)?context\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[a-z]+:)?context>/gi;
  const contexts = [];
  while ((m = contextRe.exec(html)) !== null) {
    const [, id, body] = m;
    const endM = body.match(/<(?:[a-z]+:)?endDate>\s*([^\s<]+)\s*<\/(?:[a-z]+:)?endDate>/i);
    const instM = body.match(/<(?:[a-z]+:)?instant>\s*([^\s<]+)\s*<\/(?:[a-z]+:)?instant>/i);
    if (endM) contexts.push({ id, type: "period", date: endM[1].trim() });
    if (instM) contexts.push({ id, type: "instant", date: instM[1].trim() });
  }
  console.log(`Total contexts found: ${contexts.length}`);
  const matchingContexts = contexts.filter((c) => c.date === periodEnd);
  console.log(`Contexts matching ${periodEnd}: ${matchingContexts.length}`);
  if (matchingContexts.length === 0 && contexts.length > 0) {
    const sampleDates = [...new Set(contexts.map((c) => c.date))].slice(0, 10);
    console.log("Sample dates in contexts:", sampleDates);
    console.log("DIAGNOSIS: Period-end date doesn't match any context date.");
  }

  console.log("\n=== Summary ===");
  console.log("nonFraction elements:", nonFractionCount);
  console.log("Matching contexts:", matchingContexts.length);
  console.log("File size MB:", sizeMB);
  console.log("Would be rejected by 6MB limit:", buf.byteLength > 6 * 1024 * 1024);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
