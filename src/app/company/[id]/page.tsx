import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompany,
  getOfficers,
  getFilingHistory,
  formatAddress,
  formatDate,
  formatFilingDescription,
  companyTypeLabel,
  type CHOfficer,
  type CHFiling,
} from "@/lib/companies-house";

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

  // Fetch all data in parallel; profile 404 = show not-found
  const [company, officersResult, filingsResult] = await Promise.all([
    getCompany(companyNumber).catch(() => null),
    getOfficers(companyNumber).catch(() => ({ items: [] as CHOfficer[], total_results: 0 })),
    getFilingHistory(companyNumber).catch(() => ({
      items: [] as CHFiling[],
      total_count: 0,
    })),
  ]);

  if (!company) notFound();

  const currentOfficers = (officersResult.items ?? []).filter(
    (o) => !o.resigned_on
  );
  const filings = filingsResult.items ?? [];

  const chWebUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;

  // AI insights placeholder rows (same design as dashboard)
  const AI_PLACEHOLDERS = [
    {
      borderColor: "#e2e8f0",
      bg: "#f8fafc",
      title: "📄 Analysis pending",
      body: "AI document analysis will be connected in the next session. Once enabled, Claude will extract going-concern notes, audit warnings, cyber incidents and director instability signals from filed accounts.",
    },
  ];

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
                          {officer.officer_role.replace(/-/g, " ")}
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
                            {filing.type}
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

            {/* AI Document Intelligence — placeholder */}
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      backgroundColor: "#4f46e5",
                      borderRadius: "5px",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
                      AI Document Intelligence
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
                      Extracted from filed accounts
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    backgroundColor: "rgba(79,70,229,0.08)",
                    color: "#4f46e5",
                    borderRadius: "100px",
                    fontSize: "12px",
                    fontWeight: "600",
                    whiteSpace: "nowrap",
                  }}
                >
                  Coming soon
                </span>
              </div>

              <div style={{ padding: "14px 18px" }}>
                {AI_PLACEHOLDERS.map((insight) => (
                  <div
                    key={insight.title}
                    style={{
                      borderLeft: `3px solid ${insight.borderColor}`,
                      backgroundColor: insight.bg,
                      borderRadius: "0 8px 8px 0",
                      padding: "14px 18px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "700",
                        color: "#0f172a",
                        marginBottom: "5px",
                      }}
                    >
                      {insight.title}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#475569",
                        lineHeight: "1.6",
                      }}
                    >
                      {insight.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

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
          </div>
        </div>
      </main>
    </div>
  );
}
