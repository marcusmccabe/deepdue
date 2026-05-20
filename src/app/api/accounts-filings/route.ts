import { NextRequest, NextResponse } from "next/server";

const CH_BASE = "https://api.company-information.service.gov.uk";
const ACCOUNTS_TYPES = new Set(["AA", "AAMD", "AA01", "LLAA", "LLAAMD", "LLAA01"]);

function chAuth(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export async function GET(request: NextRequest) {
  const companyNumber = new URL(request.url).searchParams
    .get("companyNumber")
    ?.toUpperCase();

  if (!companyNumber) {
    return NextResponse.json({ error: "Missing companyNumber" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${CH_BASE}/company/${companyNumber}/filing-history?items_per_page=25&category=accounts`,
      { headers: { Authorization: chAuth() }, cache: "no-store" }
    );

    if (!res.ok) {
      return NextResponse.json({ items: [] });
    }

    const data = await res.json();
    const items = (data.items ?? []).filter(
      (f: { type?: string; links?: { document_metadata?: string } }) =>
        f.links?.document_metadata && ACCOUNTS_TYPES.has(f.type ?? "")
    );

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
