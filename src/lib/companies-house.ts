/**
 * Server-side Companies House API utility.
 * The API key never leaves the server — use this in Server Components and
 * Server Actions. For client-side calls, go through /api/companies-house.
 */

const BASE_URL = "https://api.company-information.service.gov.uk";

function authHeader(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

async function chFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface CHAddress {
  premises?: string;
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
}

export interface CHSearchItem {
  company_name: string;
  company_number: string;
  company_status: string;
  company_type?: string;
  date_of_creation?: string;
  address_snippet: string;
  address?: CHAddress;
}

export interface CHCompany {
  company_name: string;
  company_number: string;
  company_status: string;
  company_type: string;
  date_of_creation: string;
  registered_office_address: CHAddress;
  sic_codes?: string[];
  jurisdiction?: string;
  has_been_liquidated?: boolean;
  has_insolvency_history?: boolean;
}

export interface CHOfficer {
  name: string;
  officer_role?: string;
  appointed_on?: string;
  resigned_on?: string;
  nationality?: string;
  occupation?: string;
  address?: CHAddress;
  date_of_birth?: { month: number; year: number };
}

export interface CHOfficersResponse {
  items: CHOfficer[];
  total_results: number;
  active_count?: number;
  resigned_count?: number;
}

export interface CHFiling {
  date?: string;
  description?: string;
  description_values?: Record<string, string>;
  type?: string;
  transaction_id?: string;
  links?: {
    document_metadata?: string;
    self?: string;
  };
}

export interface CHFilingHistoryResponse {
  items: CHFiling[];
  total_count: number;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function searchCompanies(
  query: string,
  itemsPerPage = 10
): Promise<{ items: CHSearchItem[]; total_results: number }> {
  const res = await chFetch(
    `/search/companies?q=${encodeURIComponent(query)}&items_per_page=${itemsPerPage}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`CH search error ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new Error("Failed to parse search response");
  }
}

export async function getCompany(companyNumber: string): Promise<CHCompany> {
  const res = await chFetch(`/company/${companyNumber}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CH company error ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new Error("Failed to parse company response");
  }
}

export async function getOfficers(
  companyNumber: string
): Promise<CHOfficersResponse> {
  const res = await chFetch(
    `/company/${companyNumber}/officers?items_per_page=50`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`CH officers error ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new Error("Failed to parse officers response");
  }
}

export async function getFilingHistory(
  companyNumber: string
): Promise<CHFilingHistoryResponse> {
  const res = await chFetch(
    `/company/${companyNumber}/filing-history?items_per_page=10`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`CH filings error ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new Error("Failed to parse filings response");
  }
}

// ── Formatting helpers ───────────────────────────────────────────────────────

export function formatAddress(addr?: CHAddress): string {
  if (!addr) return "Not available";
  return [
    addr.premises,
    addr.address_line_1,
    addr.address_line_2,
    addr.locality,
    addr.region,
    addr.postal_code,
    addr.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatFilingDescription(
  description: string | undefined | null,
  values?: Record<string, string>
): string {
  if (!description) return "Filing document";
  // Replace template placeholders like {change_date}
  let text = description.replace(/-/g, " ");
  if (values) {
    for (const [k, v] of Object.entries(values)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function companyTypeLabel(type: string | undefined | null): string {
  if (!type) return "Company";
  const map: Record<string, string> = {
    "ltd": "Private Limited Company",
    "llp": "Limited Liability Partnership",
    "plc": "Public Limited Company",
    "private-unlimited": "Private Unlimited",
    "private-unlimited-nsc": "Private Unlimited (no share capital)",
    "old-public-company": "Old Public Company",
    "private-limited-guarant-nsc": "Private Limited by Guarantee",
    "private-limited-guarant-nsc-limited-exemption":
      "Private Limited by Guarantee (exemption)",
    "registered-society-non-jurisdictional": "Registered Society",
    "industrial-and-provident-society": "Industrial & Provident Society",
    "northern-ireland": "Northern Ireland Company",
    "northern-ireland-other": "Northern Ireland (other)",
    "royal-charter": "Royal Charter",
    "investment-company-with-variable-capital": "ICVC",
    "unregistered-company": "Unregistered Company",
    "other": "Other",
    "european-public-limited-liability-company-se":
      "European Public Limited (SE)",
    "uk-establishment": "UK Establishment",
    "scottish-partnership": "Scottish Partnership",
    "charitable-incorporated-organisation": "Charitable Incorporated Organisation",
    "scottish-charitable-incorporated-organisation":
      "Scottish Charitable Incorporated Organisation",
    "further-education-or-sixth-form-college-corporation":
      "Further Education / Sixth Form College",
  };
  return map[type] ?? type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
