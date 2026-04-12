import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.company-information.service.gov.uk";

/**
 * GET /api/companies-house?path=/search/companies&q=tesco
 *
 * Proxies any Companies House API request through the server so the API key
 * is never exposed in the browser. The `path` param maps to the CH endpoint;
 * all other params are forwarded as-is.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  // Diagnostic — visible in Vercel function logs
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  console.log(
    "[companies-house] API key present:",
    !!key,
    "| length:",
    key.length
  );

  if (!path || !path.startsWith("/")) {
    return NextResponse.json({ error: "Invalid or missing path" }, { status: 400 });
  }

  // Forward all query params except our internal `path` key
  const forwarded = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== "path") forwarded.set(key, value);
  });

  const chUrl =
    `${BASE_URL}${path}` +
    (forwarded.toString() ? `?${forwarded.toString()}` : "");

  const credentials = Buffer.from(`${key}:`).toString("base64");
  const auth = `Basic ${credentials}`;

  try {
    const res = await fetch(chUrl, {
      headers: { Authorization: auth },
      cache: "no-store",
    });

    console.log("[companies-house] CH response status:", res.status, "for", path);

    // Mirror the status code so callers can handle 404, 429, etc.
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach the Companies House API" },
      { status: 502 }
    );
  }
}
