import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompany,
  getOfficers,
  getFilingHistory,
  getCharges,
  getPSCs,
  getOfficerAppointments,
  formatAddress,
  formatDate,
  formatFilingDescription,
  companyTypeLabel,
  type CHOfficer,
  type CHFiling,
  type CHCharge,
  type CHPsc,
  type CHAppointment,
} from "@/lib/companies-house";
import dynamic from "next/dynamic";
import AIAnalysisCard from "@/components/AIAnalysisCard";

const AccountsChat = dynamic(() => import("@/components/AccountsChat"), {
  ssr: false,
  loading: () => (
    <div style={{ backgroundColor: "#fef9c3", border: "1px solid #fde047", padding: "12px 16px", borderRadius: "8px", fontSize: "12px", color: "#854d0e" }}>
      Loading chat panel…
    </div>
  ),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEALTH_SCORE = 74; // placeholder — will be dynamic in a future session
const CIRCUMFERENCE = 2 * Math.PI * 40; // r = 40  →  ~251.3
const FILLED = (HEALTH_SCORE / 100) * CIRCUMFERENCE;
const UNFILLED = CIRCUMFERENCE - FILLED;

function HealthRing() {
  const color =
    HEALTH_SCORE >= 75 ? "#059669" : HEALTH_SCORE >= 50 ? "#4f46e5" : "#d97706";

  return (
    <div style={{ textAlign: "center" }}>
      <svg
        width="108"
        height="108"
        viewBox="0 0 100 100"
        style={{ display: "block", margin: "0 auto" }}
        aria-label={`Health score: ${HEALTH_SCORE}`}
      >
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="9"
        />
        {/* Progress */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeDasharray={`${FILLED} ${UNFILLED}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        {/* Label */}
        <text
          x="50"
          y="46"
          textAnchor="middle"
          fontSize="22"
          fontWeight="800"
          fill="#0f172a"
          fontFamily="inherit"
        >
          {HEALTH_SCORE}
        </text>
        <text
          x="50"
          y="60"
          textAnchor="middle"
          fontSize="9"
          fill="#94a3b8"
          fontFamily="inherit"
          fontWeight="500"
        >
          /100
        </text>
      </svg>
      <div
        style={{
          marginTop: "8px",
          fontSize: "12px",
          fontWeight: "600",
          color,
        }}
      >
        {HEALTH_SCORE >= 75
          ? "Low Risk"
          : HEALTH_SCORE >= 50
          ? "Medium Risk"
          : "High Risk"}
      </div>
      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
        Placeholder — AI scoring coming soon
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  const dissolved = status === "dissolved";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: "100px",
        fontSize: "12px",
        fontWeight: "600",
        textTransform: "capitalize",
        color: active ? "#059669" : dissolved ? "#dc2626" : "#d97706",
        backgroundColor: active
          ? "rgba(5,150,105,0.10)"
          : dissolved
          ? "rgba(220,38,38,0.10)"
          : "rgba(217,119,6,0.10)",
        border: `1px solid ${
          active
            ? "rgba(5,150,105,0.25)"
            : dissolved
            ? "rgba(220,38,38,0.25)"
            : "rgba(217,119,6,0.25)"
        }`,
      }}
    >
      {status || "unknown"}
    </span>
  );
}

const CARD: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
  overflow: "hidden",
};

const CARD_HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "15px 18px",
  borderBottom: "1px solid #e2e8f0",
};

const CARD_TITLE: CSSProperties = {
  fontSize: "13px",
  fontWeight: "700",
  color: "#0f172a",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const companyNumber = id.toUpperCase();

  // Phase 1: fetch all independent data in parallel; profile 404 = show not-found
  const [company, officersResult, filingsResult, chargesResult, pscsResult] = await Promise.all([
    getCompany(companyNumber).catch(() => null),
    getOfficers(companyNumber).catch(() => ({ items: [] as CHOfficer[], total_results: 0 })),
    getFilingHistory(companyNumber).catch(() => ({
      items: [] as CHFiling[],
      total_count: 0,
    })),
    getCharges(companyNumber).catch(() => ({ items: [] as CHCharge[], total_count: 0 })),
    getPSCs(companyNumber).catch(() => ({ items: [] as CHPsc[], total_results: 0 })),
  ]);

  if (!company) notFound();

  const currentOfficers = (officersResult.items ?? []).filter(
    (o) => !o.resigned_on
  );
  const filings = filingsResult.items ?? [];
  const charges = chargesResult.items ?? [];
  // Group by lender + charge type; CH returns charges date-desc so first entry per key is newest
  const groupedCharges = (() => {
    const map = new Map<string, { charge: CHCharge; count: number }>();
    for (const charge of charges) {
      const lender = charge.persons_entitled?.[0]?.name ?? "Unknown lender";
      const chargeType = charge.classification?.description ?? "Registered charge";
      const key = `${lender}||${chargeType}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { charge, count: 1 });
      }
    }
    return Array.from(map.values());
  })();
  const activePscs = (pscsResult.items ?? []).filter((p) => !p.ceased_on);

  // Phase 2: fetch officer appointments (depends on officers from phase 1)
  const appointmentsData = await Promise.all(
    currentOfficers.slice(0, 5).map(async (officer) => {
      const path = officer.links?.officer?.appointments;
      if (!path) return { officer, appointments: [] as CHAppointment[] };
      try {
        const result = await getOfficerAppointments(path);
        return { officer, appointments: result.items ?? [] };
      } catch {
        return { officer, appointments: [] as CHAppointment[] };
      }
    })
  );

  // Gazette detection — scan filings + company flags
  const GAZETTE_TYPE_RE = /^(GAZ|DISS|AM0[1-9]|LIQD?|WU0|IN0)/i;
  const GAZETTE_DESC_RE = /gazette|insolvency|liquidat|winding.up|struck.off|dissolution|administration/i;
  const gazetteFilings = filings.filter(
    (f) =>
      (f.type && GAZETTE_TYPE_RE.test(f.type)) ||
      (f.description && GAZETTE_DESC_RE.test(f.description))
  );
  const hasGazetteWarning =
    !!company?.has_insolvency_history ||
    !!company?.has_been_liquidated ||
    gazetteFilings.length > 0;
  const gazetteReasons: string[] = [];
  if (company?.has_been_liquidated) gazetteReasons.push("Company has been liquidated");
  if (company?.has_insolvency_history) gazetteReasons.push("Insolvency history recorded");
  // Deduplicate by type code — filings arrive date-desc, so first match is most recent
  const seenGazetteTypes = new Set<string>();
  gazetteFilings.forEach((f) => {
    const key = f.type ?? f.description ?? "unknown";
    if (seenGazetteTypes.has(key)) return;
    seenGazetteTypes.add(key);
    gazetteReasons.push(
      `Filing ${f.type ?? "—"}: ${formatFilingDescription(f.description, f.description_values)} (${formatDate(f.date)})`
    );
  });

  const chWebUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;


  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        fontFamily:
          'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
      }}
    >
      {/* ── Top nav bar ── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          zIndex: 50,
          padding: "0 32px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#475569",
            fontSize: "13px",
            fontWeight: "500",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 15 15"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8.842 3.135a.5.5 0 0 1 .023.707L5.435 7.5l3.43 3.658a.5.5 0 0 1-.73.684l-3.75-4a.5.5 0 0 1 0-.684l3.75-4a.5.5 0 0 1 .707-.023Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
          Dashboard
        </Link>

        <span style={{ color: "#e2e8f0" }}>›</span>

        <span
          style={{
            fontSize: "13px",
            color: "#0f172a",
            fontWeight: "600",
            maxWidth: "360px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {company.company_name}
        </span>

        <div style={{ flex: 1 }} />

        {/* Logo */}
        <div
          style={{
            fontFamily:
              'var(--font-instrument-serif), "Instrument Serif", serif',
            fontSize: "18px",
          }}
        >
          <span style={{ color: "#0f172a" }}>Deep</span>
          <span style={{ color: "#4f46e5" }}>Due</span>
          <span style={{ color: "#94a3b8", fontSize: "13px" }}>.ai</span>
        </div>
      </nav>

      {/* ── Main layout ── */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 32px 64px" }}>
        {/* ── Company header ── */}
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              flexWrap: "wrap",
              marginBottom: "8px",
            }}
          >
            <h1
              style={{
                fontFamily:
                  'var(--font-instrument-serif), "Instrument Serif", serif',
                fontSize: "34px",
                fontWeight: "400",
                color: "#0f172a",
                lineHeight: "1.2",
                margin: 0,
              }}
            >
              {company.company_name}
            </h1>
            <div style={{ paddingTop: "6px" }}>
              <StatusBadge status={company.company_status} />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
              alignItems: "center",
              fontSize: "13px",
              color: "#475569",
            }}
          >
            <span>
              <span style={{ color: "#94a3b8", marginRight: "4px" }}>No.</span>
              <span style={{ fontFamily: "'Courier New', monospace", fontWeight: "600", color: "#0f172a" }}>
                {company.company_number}
              </span>
            </span>
            <span style={{ color: "#e2e8f0" }}>·</span>
            <span>
              Incorporated{" "}
              <span style={{ color: "#0f172a", fontWeight: "500" }}>
                {formatDate(company.date_of_creation)}
              </span>
            </span>
            <span style={{ color: "#e2e8f0" }}>·</span>
            <span style={{ color: "#0f172a", fontWeight: "500" }}>
              {companyTypeLabel(company.company_type)}
            </span>
            <span style={{ color: "#e2e8f0" }}>·</span>
            <a
              href={chWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#4f46e5",
                fontSize: "12px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              View on Companies House
              <svg width="10" height="10" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path
                  d="M3 2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8.5a.5.5 0 0 0-1 0V12H3V3h3.5a.5.5 0 0 0 0-1H3Zm6.854.146a.5.5 0 0 0-.707.708L11.293 5H8.5a.5.5 0 0 0 0 1h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-1 0v2.793L9.854 2.146Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* ── Gazette / Insolvency warning banner ── */}
        {hasGazetteWarning && (
          <div
            style={{
              marginBottom: "20px",
              padding: "14px 18px",
              backgroundColor: "rgba(220,38,38,0.06)",
              border: "1px solid rgba(220,38,38,0.25)",
              borderRadius: "10px",
              borderLeft: "4px solid #dc2626",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              style={{ flexShrink: 0, marginTop: "1px" }}
            >
              <path
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495Z"
                stroke="#dc2626"
                strokeWidth="1.5"
              />
              <path
                d="M10 8v3m0 2.5v.5"
                stroke="#dc2626"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#dc2626",
                  marginBottom: "5px",
                }}
              >
                Gazette / Insolvency Notice Detected
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  fontSize: "12px",
                  color: "#475569",
                }}
              >
                {gazetteReasons.map((r, i) => (
                  <span key={i}>{r}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Two-column grid ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* ═══ LEFT COLUMN ═══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Directors */}
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <span style={CARD_TITLE}>
                  Directors &amp; Officers
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    fontWeight: "500",
                  }}
                >
                  {currentOfficers.length} current
                </span>
              </div>

              {currentOfficers.length === 0 ? (
                <div
                  style={{
                    padding: "28px 18px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  No current officers found
                </div>
              ) : (
                <div>
                  {currentOfficers.map((officer, i) => (
                    <div
                      key={`${officer.name}-${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        padding: "13px 18px",
                        borderBottom:
                          i < currentOfficers.length - 1
                            ? "1px solid #f1f5f9"
                            : "none",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#0f172a",
                            marginBottom: "3px",
                          }}
                        >
                          {officer.name}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#475569",
                            textTransform: "capitalize",
                          }}
                        >
                          {(officer.officer_role ?? "officer").replace(/-/g, " ")}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{ fontSize: "11px", color: "#94a3b8" }}
                        >
                          Appointed
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: "500",
                            color: "#475569",
                            marginTop: "1px",
                          }}
                        >
                          {formatDate(officer.appointed_on)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filing History */}
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <span style={CARD_TITLE}>Filing History</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                  Last {filings.length}
                </span>
              </div>

              {filings.length === 0 ? (
                <div
                  style={{
                    padding: "28px 18px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  No filings found
                </div>
              ) : (
                <div>
                  {filings.map((filing, i) => (
                    <div
                      key={filing.transaction_id ?? `${filing.date}-${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        padding: "12px 18px",
                        borderBottom:
                          i < filings.length - 1
                            ? "1px solid #f1f5f9"
                            : "none",
                        gap: "12px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "#0f172a",
                            marginBottom: "3px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatFilingDescription(
                            filing.description,
                            filing.description_values
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#94a3b8",
                              fontFamily: "'Courier New', monospace",
                            }}
                          >
                            {filing.type ?? "—"}
                          </span>
                          <span style={{ fontSize: "11px", color: "#cbd5e1" }}>·</span>
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                            {formatDate(filing.date)}
                          </span>
                        </div>
                      </div>

                      <a
                        href={`${chWebUrl}/filing-history`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "11px",
                          color: "#4f46e5",
                          fontWeight: "500",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        View ↗
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Charges Register ── */}
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <span style={CARD_TITLE}>Charges Register</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                  {charges.length} {charges.length === 1 ? "charge" : "charges"}
                </span>
              </div>
              {charges.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No charges registered
                </div>
              ) : (
                <div>
                  {groupedCharges.map(({ charge, count }, i) => {
                    const isOutstanding = charge.status === "outstanding";
                    const isPartSatisfied = charge.status === "part-satisfied";
                    const statusColor = isOutstanding ? "#dc2626" : isPartSatisfied ? "#d97706" : "#059669";
                    const statusBg = isOutstanding ? "rgba(220,38,38,0.10)" : isPartSatisfied ? "rgba(217,119,6,0.10)" : "rgba(5,150,105,0.10)";
                    const statusBorder = isOutstanding ? "rgba(220,38,38,0.25)" : isPartSatisfied ? "rgba(217,119,6,0.25)" : "rgba(5,150,105,0.25)";
                    const lenderName = charge.persons_entitled?.[0]?.name ?? "Unknown lender";
                    return (
                      <div
                        key={charge.charge_code ?? i}
                        style={{
                          padding: "13px 18px",
                          borderBottom: i < groupedCharges.length - 1 ? "1px solid #f1f5f9" : "none",
                          borderLeft: isOutstanding ? "3px solid #dc2626" : "none",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "3px" }}>
                              {lenderName}
                              {count > 1 && (
                                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "400", marginLeft: "6px" }}>
                                  ({count} charges)
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569" }}>
                              {charge.classification?.description ?? "Registered charge"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: "100px",
                                fontSize: "11px",
                                fontWeight: "600",
                                color: statusColor,
                                backgroundColor: statusBg,
                                border: `1px solid ${statusBorder}`,
                                textTransform: "capitalize",
                              }}
                            >
                              {(charge.status ?? "unknown").replace(/-/g, " ")}
                            </span>
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                              {formatDate(charge.created_on)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── PSC / Shareholder Structure ── */}
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <span style={CARD_TITLE}>Persons with Significant Control</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                  {activePscs.length} PSC{activePscs.length !== 1 ? "s" : ""}
                </span>
              </div>
              {activePscs.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No PSC information available
                </div>
              ) : (
                <div>
                  {activePscs.map((psc, i) => {
                    const isCorporate =
                      psc.kind?.includes("corporate") || psc.kind?.includes("legal-person");
                    const ukJurisdictions = ["england", "wales", "scotland", "northern ireland", "united kingdom", "great britain", "england and wales"];
                    const residenceCountry = (
                      psc.country_of_residence ??
                      psc.identification?.country_registered ??
                      psc.address?.country ??
                      ""
                    ).toLowerCase().trim();
                    const isOffshore =
                      !!residenceCountry &&
                      !ukJurisdictions.some((j) => residenceCountry.includes(j));
                    const ownershipBand = (() => {
                      const share = psc.natures_of_control?.find((n) => n.includes("ownership-of-shares"));
                      if (!share) return null;
                      if (share.includes("25-to-50")) return "25–50%";
                      if (share.includes("50-to-75")) return "50–75%";
                      if (share.includes("75-to-100")) return "75–100%";
                      if (share.includes("more-than-25")) return ">25%";
                      return null;
                    })();
                    const natureSummary = psc.natures_of_control
                      ?.map((n) =>
                        n
                          .replace(/-/g, " ")
                          .replace(/\b(\w)/g, (c) => c.toUpperCase())
                          .replace("25 To 50 Percent", "25–50%")
                          .replace("50 To 75 Percent", "50–75%")
                          .replace("75 To 100 Percent", "75–100%")
                          .replace("More Than 25 Percent", ">25%")
                          .replace("Significant Influence Or Control", "Significant Influence / Control")
                      )
                      .join(" · ");
                    return (
                      <div
                        key={psc.name ?? i}
                        style={{
                          padding: "13px 18px",
                          borderBottom: i < activePscs.length - 1 ? "1px solid #f1f5f9" : "none",
                          borderLeft: isOffshore
                            ? "3px solid #d97706"
                            : isCorporate
                            ? "3px solid #4f46e5"
                            : "none",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
                                {psc.name ?? "Unknown"}
                              </span>
                              {isCorporate && (
                                <span style={{ fontSize: "10px", fontWeight: "600", color: "#4f46e5", backgroundColor: "rgba(79,70,229,0.08)", padding: "1px 6px", borderRadius: "4px" }}>
                                  Corporate
                                </span>
                              )}
                              {isOffshore && (
                                <span style={{ fontSize: "10px", fontWeight: "600", color: "#d97706", backgroundColor: "rgba(217,119,6,0.10)", padding: "1px 6px", borderRadius: "4px" }}>
                                  Offshore
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569" }}>
                              {natureSummary ?? "—"}
                            </div>
                          </div>
                          {ownershipBand && (
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ownership</div>
                              <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>{ownershipBand}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Director Network (Layer 2 cross-reference) ── */}
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <span style={CARD_TITLE}>Director Network</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                  Layer 2 cross-reference
                </span>
              </div>
              {appointmentsData.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No director appointment data available
                </div>
              ) : (
                <div>
                  {appointmentsData.map(({ officer, appointments }, i) => {
                    const otherCompanies = appointments.filter(
                      (a) => a.appointed_to?.company_number !== companyNumber
                    );
                    if (otherCompanies.length === 0) return null;
                    return (
                      <div
                        key={`${officer.name}-${i}`}
                        style={{
                          padding: "13px 18px",
                          borderBottom: i < appointmentsData.length - 1 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "8px" }}>
                          {officer.name}
                          <span style={{ fontSize: "11px", fontWeight: "400", color: "#94a3b8", marginLeft: "6px" }}>
                            {otherCompanies.length} other appointment{otherCompanies.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          {otherCompanies.slice(0, 10).map((appt, j) => {
                            const isDissolved = appt.appointed_to?.company_status === "dissolved";
                            const isStrikeOff = appt.appointed_to?.company_status === "active-proposal-to-strike-off";
                            const isRisk = isDissolved || isStrikeOff;
                            return (
                              <div
                                key={j}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "10px",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: isRisk ? "#dc2626" : "#475569",
                                    fontWeight: isRisk ? "500" : "400",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {appt.appointed_to?.company_name ?? "Unknown company"}
                                </span>
                                {isRisk && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: "600",
                                      color: "#dc2626",
                                      backgroundColor: "rgba(220,38,38,0.10)",
                                      border: "1px solid rgba(220,38,38,0.25)",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      whiteSpace: "nowrap",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {isDissolved ? "Dissolved" : "Proposed strike-off"}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {otherCompanies.length > 10 && (
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                              +{otherCompanies.length - 10} more on Companies House
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI Document Intelligence */}
            <AIAnalysisCard companyNumber={companyNumber} />
          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", overflow: "visible" }}>

            {/* Company Details card */}
            <div style={{ ...CARD, overflow: "visible" }}>
              <div style={{ ...CARD_HEADER, borderBottom: "1px solid #e2e8f0" }}>
                <span style={CARD_TITLE}>Company Details</span>
              </div>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Registered address */}
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: "600",
                      color: "#94a3b8",
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      marginBottom: "5px",
                    }}
                  >
                    Registered Address
                  </div>
                  <div style={{ fontSize: "13px", color: "#0f172a", lineHeight: "1.6" }}>
                    {formatAddress(company.registered_office_address)}
                  </div>
                </div>

                <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />

                {/* SIC codes */}
                {company.sic_codes && company.sic_codes.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: "600",
                        color: "#94a3b8",
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        marginBottom: "7px",
                      }}
                    >
                      Nature of Business (SIC)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {company.sic_codes.map((code) => (
                        <span
                          key={code}
                          style={{
                            padding: "3px 9px",
                            backgroundColor: "rgba(79,70,229,0.07)",
                            color: "#4f46e5",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            fontFamily: "'Courier New', monospace",
                          }}
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />

                {/* Key dates */}
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: "600",
                      color: "#94a3b8",
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      marginBottom: "5px",
                    }}
                  >
                    Incorporated
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a" }}>
                    {formatDate(company.date_of_creation)}
                  </div>
                </div>

                {company.jurisdiction && (
                  <>
                    <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />
                    <div>
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: "600",
                          color: "#94a3b8",
                          letterSpacing: "0.07em",
                          textTransform: "uppercase",
                          marginBottom: "5px",
                        }}
                      >
                        Jurisdiction
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "500",
                          color: "#0f172a",
                          textTransform: "capitalize",
                        }}
                      >
                        {company.jurisdiction.replace(/-/g, " ")}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Health Score card */}
            <div style={{ ...CARD, padding: "20px 18px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#0f172a",
                  marginBottom: "16px",
                  textAlign: "center",
                }}
              >
                Health Score
              </div>
              <HealthRing />
            </div>

            {/* Chat panel */}
            <AccountsChat
              companyNumber={companyNumber}
              companyName={company.company_name}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
