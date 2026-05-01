import { NextRequest, NextResponse } from "next/server";

const CH_BASE = "https://api.company-information.service.gov.uk";
const MAX_ACTIVE_OFFICERS_FOR_HISTORY = 10;

interface OfficerSummary {
  name?: string;
  resigned_on?: string;
  links?: {
    officer?: {
      appointments?: string;
    };
  };
  [key: string]: unknown;
}

async function chFetch(path: string, auth: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${CH_BASE}${path}`, {
      headers: { Authorization: auth },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[company-full-context] CH ${res.status} for ${path}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[company-full-context] Network error for ${path}:`, err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyNumber = searchParams.get("companyNumber");

  if (!companyNumber) {
    return NextResponse.json({ error: "companyNumber is required" }, { status: 400 });
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  const auth = "Basic " + Buffer.from(`${apiKey}:`).toString("base64");

  const [
    companyProfile,
    officersResponse,
    pscResponse,
    chargesResponse,
    filingHistoryResponse,
  ] = await Promise.all([
    chFetch(`/company/${companyNumber}`, auth),
    chFetch(`/company/${companyNumber}/officers?items_per_page=50`, auth),
    chFetch(
      `/company/${companyNumber}/persons-with-significant-control?items_per_page=50`,
      auth
    ),
    chFetch(`/company/${companyNumber}/charges?items_per_page=25`, auth),
    chFetch(`/company/${companyNumber}/filing-history?items_per_page=20`, auth),
  ]);

  const officers: OfficerSummary[] =
    (officersResponse as { items?: OfficerSummary[] } | null)?.items ?? [];
  const personsWithSignificantControl =
    (pscResponse as { items?: unknown[] } | null)?.items ?? [];
  const charges = (chargesResponse as { items?: unknown[] } | null)?.items ?? [];
  const filingHistory =
    (filingHistoryResponse as { items?: unknown[] } | null)?.items ?? [];

  const activeOfficers = officers
    .filter((o) => !o.resigned_on && o.links?.officer?.appointments)
    .slice(0, MAX_ACTIVE_OFFICERS_FOR_HISTORY);

  console.log(`[company-full-context] Fetching appointments for ${activeOfficers.length} active officers`);

  const appointmentsResults = await Promise.all(
    activeOfficers.map(async (officer) => {
      const appointmentsPath = officer.links!.officer!.appointments!;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(
          `${CH_BASE}${appointmentsPath}?items_per_page=50`,
          { headers: { Authorization: auth }, cache: "no-store", signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (!res.ok) return { name: officer.name ?? "Unknown officer", items: [] };
        const data = await res.json();
        const items = (data as { items?: unknown[] } | null)?.items ?? [];
        return { name: officer.name ?? "Unknown officer", items };
      } catch {
        clearTimeout(timeoutId);
        return { name: officer.name ?? "Unknown officer", items: [] };
      }
    })
  );

  const directorAppointments: Record<string, unknown[]> = {};
  for (const { name, items } of appointmentsResults) {
    directorAppointments[name] = items;
  }

  const payload = {
    companyProfile: companyProfile ?? null,
    officers,
    directorAppointments,
    personsWithSignificantControl,
    charges,
    filingHistory,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
