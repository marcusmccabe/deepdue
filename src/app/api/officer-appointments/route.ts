import { NextRequest, NextResponse } from "next/server";

const CH_BASE = "https://api.company-information.service.gov.uk";

/**
 * GET /api/officer-appointments?appointmentsUrl=/officers/{id}/appointments
 *
 * Proxies a Companies House officer-appointments request so the API key
 * stays server-side. Returns { items: [...] } on success, or { items: [] }
 * on any failure so the client can always safely iterate.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appointmentsUrl = searchParams.get("appointmentsUrl");

  if (!appointmentsUrl || !appointmentsUrl.startsWith("/")) {
    return NextResponse.json({ items: [] }, { status: 400 });
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  const auth = "Basic " + Buffer.from(`${apiKey}:`).toString("base64");

  try {
    const res = await fetch(`${CH_BASE}${appointmentsUrl}?items_per_page=50`, {
      headers: { Authorization: auth },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[officer-appointments] CH returned ${res.status} for ${appointmentsUrl}`);
      return NextResponse.json({ items: [] }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    console.error(`[officer-appointments] Network error for ${appointmentsUrl}`);
    return NextResponse.json({ items: [] }, { status: 502 });
  }
}
