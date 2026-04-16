"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import CompanyTabs, { type TabId } from "@/components/CompanyTabs";
import AIAnalysisCard from "@/components/AIAnalysisCard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string): string {
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

function fmtAddress(addr?: Record<string, string | undefined>): string {
  if (!addr) return "—";
  return (
    [
      addr.premises,
      addr.address_line_1,
      addr.address_line_2,
      addr.locality,
      addr.region,
      addr.postal_code,
      addr.country,
    ]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

function fmtFilingDesc(description?: string | null, values?: Record<string, string>): string {
  if (!description) return "Filing document";
  let text = description.replace(/-/g, " ");
  if (values) {
    for (const [k, v] of Object.entries(values)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function fmtCompanyType(type?: string | null): string {
  if (!type) return "—";
  const map: Record<string, string> = {
    ltd: "Private Limited Company",
    llp: "Limited Liability Partnership",
    plc: "Public Limited Company",
    "private-unlimited": "Private Unlimited",
    "private-limited-guarant-nsc": "Private Limited by Guarantee",
    "charitable-incorporated-organisation":
      "Charitable Incorporated Organisation",
    "scottish-charitable-incorporated-organisation":
      "Scottish Charitable Incorporated Organisation",
  };
  return (
    map[type] ??
    type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

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

const LABEL: CSSProperties = {
  fontSize: "10px",
  fontWeight: "600",
  color: "#94a3b8",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  marginBottom: "4px",
};

// ── Sub-components ────────────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export default function CompanyPageClient({
  company,
  officers = [],
  filings = [],
  charges = [],
  pscs = [],
  appointments = [],
}: {
  company: any;
  officers?: any[];
  filings?: any[];
  charges?: any[];
  pscs?: any[];
  appointments?: any[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // ── Director network state ──────────────────────────────────────────────────
  const [networkData, setNetworkData] = useState<Record<string, any[]>>({});
  const [networkLoading, setNetworkLoading] = useState(true);

  useEffect(() => {
    async function fetchNetwork() {
      const results = await Promise.allSettled(
        officers.map(async (officer: any) => {
          const url = officer.links?.officer?.appointments;
          if (!url) return { name: officer.name, items: [] };
          const res = await fetch(`/api/officer-appointments?appointmentsUrl=${encodeURIComponent(url)}`);
          const data = await res.json();
          return { name: officer.name, items: data.items ?? [] };
        })
      );

      const map: Record<string, any[]> = {};
      for (const r of results) {
        if (r.status === "fulfilled") {
          map[r.value.name] = r.value.items;
        }
      }
      setNetworkData(map);
      setNetworkLoading(false);
    }

    if (officers.length > 0) {
      fetchNetwork();
    } else {
      setNetworkLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Company header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "16px",
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

        <StatusBadge status={company.company_status} />

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              color: "#475569",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            + Watchlist
          </button>
          <button
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              color: "#475569",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Export PDF
          </button>
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("deepdue:open-chat"))
            }
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#4f46e5",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Ask AI
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ marginBottom: "24px" }}>
        <CompanyTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Two-column layout */}
      <div style={{ display: "flex", gap: "20px", alignItems: "start" }}>
        {/* ── Left main column ── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Overview tab */}
          {activeTab === "overview" && (
            <>
              {/* Directors & Officers */}
              <div style={CARD}>
                <div style={CARD_HEADER}>
                  <span style={CARD_TITLE}>Directors &amp; Officers</span>
                  <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                    {officers.length} current
                  </span>
                </div>
                {officers.length === 0 ? (
                  <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                    No officers found
                  </div>
                ) : (
                  <div>
                    {officers.map((officer: any, i: number) => (
                      <div
                        key={`${officer.name}-${i}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          padding: "13px 18px",
                          borderBottom: i < officers.length - 1 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "3px" }}>
                            {officer.name}
                          </div>
                          <div style={{ fontSize: "12px", color: "#475569", textTransform: "capitalize" }}>
                            {(officer.officer_role ?? "officer").replace(/-/g, " ")}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>Appointed</div>
                          <div style={{ fontSize: "12px", fontWeight: "500", color: "#475569", marginTop: "1px" }}>
                            {fmtDate(officer.appointed_on)}
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
                  <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                    No filings found
                  </div>
                ) : (
                  <div>
                    {filings.map((filing: any, i: number) => {
                      const docUrl = filing.transaction_id
                        ? `https://find-and-update.company-information.service.gov.uk/company/${company.company_number}/filing-history/${filing.transaction_id}/document?format=pdf&download=0`
                        : null;
                      return (
                        <div
                          key={filing.transaction_id ?? `${filing.date}-${i}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            padding: "12px 18px",
                            borderBottom: i < filings.length - 1 ? "1px solid #f1f5f9" : "none",
                            gap: "12px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {fmtFilingDesc(filing.description, filing.description_values)}
                            </div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "'Courier New', monospace" }}>
                                {filing.type ?? "—"}
                              </span>
                              <span style={{ fontSize: "11px", color: "#cbd5e1" }}>·</span>
                              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                {fmtDate(filing.date)}
                              </span>
                            </div>
                          </div>
                          {docUrl && (
                            <a
                              href={docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: "11px",
                                fontWeight: "500",
                                color: "#4f46e5",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                              }}
                            >
                              View
                              <svg width="9" height="9" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                                <path d="M3 2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8.5a.5.5 0 0 0-1 0V12H3V3h3.5a.5.5 0 0 0 0-1H3Zm6.854.146a.5.5 0 0 0-.707.708L11.293 5H8.5a.5.5 0 0 0 0 1h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-1 0v2.793L9.854 2.146Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                              </svg>
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Company Timeline */}
              <div style={CARD}>
                <div style={CARD_HEADER}>
                  <span style={CARD_TITLE}>Company Timeline</span>
                  <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                    Last 15 events
                  </span>
                </div>
                {(() => {
                  type TimelineEvent = { date: string; label: string; dotColor: string };
                  const events: TimelineEvent[] = [];

                  if (company.date_of_creation) {
                    events.push({ date: company.date_of_creation, label: "Company incorporated", dotColor: "#4f46e5" });
                  }

                  for (const f of filings) {
                    const type = (f.type ?? "").toUpperCase();
                    let label: string;
                    let dotColor: string;

                    if (type === "AA" || type === "AAMD") {
                      label = "Full accounts filed"; dotColor = "#4f46e5";
                    } else if (type === "CS01") {
                      label = "Confirmation statement"; dotColor = "#059669";
                    } else if (["AP01", "AP02", "AP03"].includes(type)) {
                      label = "Officer appointed"; dotColor = "#d97706";
                    } else if (["TM01", "TM02"].includes(type)) {
                      label = "Officer resigned"; dotColor = "#dc2626";
                    } else if (["CH01", "CH02", "CH03", "CH04"].includes(type)) {
                      label = "Director details changed"; dotColor = "#94a3b8";
                    } else if (type === "MR01") {
                      label = "Charge registered"; dotColor = "#dc2626";
                    } else if (type === "MR04") {
                      label = "Charge satisfied"; dotColor = "#059669";
                    } else if (type.startsWith("PSC")) {
                      label = "PSC change"; dotColor = "#d97706";
                    } else {
                      label = fmtFilingDesc(f.description, f.description_values); dotColor = "#94a3b8";
                    }

                    events.push({ date: f.date ?? "", label, dotColor });
                  }

                  events.sort((a, b) => b.date.localeCompare(a.date));
                  const top = events.slice(0, 15);

                  if (top.length === 0) {
                    return (
                      <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                        No events found
                      </div>
                    );
                  }

                  return (
                    <div style={{ padding: "12px 18px" }}>
                      {top.map((evt, i) => (
                        <div
                          key={`${evt.date}-${i}`}
                          style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}
                        >
                          {/* Dot + connecting line */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "12px", flexShrink: 0 }}>
                            <div style={{
                              width: "8px", height: "8px", borderRadius: "50%",
                              backgroundColor: evt.dotColor, marginTop: "5px", flexShrink: 0,
                            }} />
                            {i < top.length - 1 && (
                              <div style={{ width: "2px", flex: 1, backgroundColor: "#e2e8f0", minHeight: "24px" }} />
                            )}
                          </div>
                          {/* Date */}
                          <div style={{ width: "110px", flexShrink: 0, fontSize: "11px", color: "#94a3b8", fontWeight: "500", paddingTop: "2px" }}>
                            {fmtDate(evt.date)}
                          </div>
                          {/* Description */}
                          <div style={{ flex: 1, fontSize: "13px", color: "#0f172a", fontWeight: "500", paddingBottom: "16px", paddingTop: "1px" }}>
                            {evt.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Director Network */}
              <div style={CARD}>
                <div style={CARD_HEADER}>
                  <span style={CARD_TITLE}>Director Network</span>
                  <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                    {officers.length} officer{officers.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {networkLoading ? (
                  <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                    {[0, 1, 2].map((k) => (
                      <div key={k} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ width: "40%", height: "14px", backgroundColor: "#f1f5f9", borderRadius: "4px" }} />
                        <div style={{ width: "70%", height: "12px", backgroundColor: "#f8fafc", borderRadius: "4px" }} />
                        <div style={{ width: "55%", height: "12px", backgroundColor: "#f8fafc", borderRadius: "4px" }} />
                      </div>
                    ))}
                  </div>
                ) : officers.length === 0 ? (
                  <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                    No officers found
                  </div>
                ) : (
                  <div>
                    {officers.map((officer: any, oi: number) => {
                      const allAppts = networkData[officer.name] ?? [];
                      const otherActive = allAppts.filter(
                        (a: any) => !a.resigned_on && a.appointed_to?.company_number !== company.company_number
                      );
                      return (
                        <div
                          key={`${officer.name}-${oi}`}
                          style={{
                            padding: "14px 18px",
                            borderBottom: oi < officers.length - 1 ? "1px solid #f1f5f9" : "none",
                          }}
                        >
                          <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "2px" }}>
                            {officer.name}
                          </div>
                          <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "capitalize", marginBottom: "8px" }}>
                            {(officer.officer_role ?? "officer").replace(/-/g, " ")}
                          </div>
                          {otherActive.length === 0 ? (
                            <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                              No other directorships found
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              {otherActive.slice(0, 5).map((appt: any, ai: number) => (
                                <div key={ai} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                                  <a
                                    href={`/company/${appt.appointed_to?.company_number}`}
                                    style={{ fontSize: "12px", fontWeight: "500", color: "#4f46e5", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}
                                  >
                                    {appt.appointed_to?.company_name ?? "Unknown"}
                                  </a>
                                  <span style={{ fontSize: "11px", color: "#94a3b8", flexShrink: 0 }}>
                                    {fmtDate(appt.appointed_on)}
                                  </span>
                                </div>
                              ))}
                              {otherActive.length > 5 && (
                                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "500", marginTop: "2px" }}>
                                  +{otherActive.length - 5} more companies
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AI analysis — Risks & Warnings now lives inside this card */}
              <AIAnalysisCard companyNumber={company.company_number} />
            </>
          )}

          {/* Financials tab */}
          {activeTab === "financials" && (
            <div style={{ padding: "24px", color: "grey" }}>Coming soon</div>
          )}

          {/* AI analysis tab */}
          {activeTab === "ai-analysis" && (
            <div style={{ padding: "24px", color: "grey" }}>Coming soon</div>
          )}

          {/* Directors tab */}
          {activeTab === "directors" && (
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <span style={CARD_TITLE}>Directors &amp; Officers</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                  {officers.length} current
                </span>
              </div>
              {officers.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No current officers found
                </div>
              ) : (
                <div>
                  {officers.map((officer: any, i: number) => (
                    <div
                      key={`${officer.name}-${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        padding: "13px 18px",
                        borderBottom: i < officers.length - 1 ? "1px solid #f1f5f9" : "none",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "3px" }}>
                          {officer.name}
                        </div>
                        <div style={{ fontSize: "12px", color: "#475569", textTransform: "capitalize" }}>
                          {(officer.officer_role ?? "officer").replace(/-/g, " ")}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>Appointed</div>
                        <div style={{ fontSize: "12px", fontWeight: "500", color: "#475569", marginTop: "1px" }}>
                          {fmtDate(officer.appointed_on)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filings tab */}
          {activeTab === "filings" && (
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <span style={CARD_TITLE}>Filing History</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                  Last {filings.length}
                </span>
              </div>
              {filings.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No filings found
                </div>
              ) : (
                <div>
                  {filings.map((filing: any, i: number) => (
                    <div
                      key={filing.transaction_id ?? `${filing.date}-${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        padding: "12px 18px",
                        borderBottom: i < filings.length - 1 ? "1px solid #f1f5f9" : "none",
                        gap: "12px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fmtFilingDesc(filing.description, filing.description_values)}
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "'Courier New', monospace" }}>
                            {filing.type ?? "—"}
                          </span>
                          <span style={{ fontSize: "11px", color: "#cbd5e1" }}>·</span>
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                            {fmtDate(filing.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Charges tab */}
          {activeTab === "charges" && (
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
                  {charges.map((charge: any, i: number) => {
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
                          borderBottom: i < charges.length - 1 ? "1px solid #f1f5f9" : "none",
                          borderLeft: isOutstanding ? "3px solid #dc2626" : "none",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "3px" }}>
                              {lenderName}
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569" }}>
                              {charge.classification?.description ?? "Registered charge"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", color: statusColor, backgroundColor: statusBg, border: `1px solid ${statusBorder}`, textTransform: "capitalize" }}>
                              {(charge.status ?? "unknown").replace(/-/g, " ")}
                            </span>
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                              {fmtDate(charge.created_on)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Ownership tab */}
          {activeTab === "ownership" && (
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <span style={CARD_TITLE}>Persons with Significant Control</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                  {pscs.length} PSC{pscs.length !== 1 ? "s" : ""}
                </span>
              </div>
              {pscs.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No PSC information available
                </div>
              ) : (
                <div>
                  {pscs.map((psc: any, i: number) => {
                    const isCorporate = psc.kind?.includes("corporate") || psc.kind?.includes("legal-person");
                    const ukJurisdictions = ["england", "wales", "scotland", "northern ireland", "united kingdom", "great britain", "england and wales"];
                    const residenceCountry = (psc.country_of_residence ?? psc.identification?.country_registered ?? psc.address?.country ?? "").toLowerCase().trim();
                    const isOffshore = !!residenceCountry && !ukJurisdictions.some((j) => residenceCountry.includes(j));
                    const ownershipBand = (() => {
                      const share = psc.natures_of_control?.find((n: string) => n.includes("ownership-of-shares"));
                      if (!share) return null;
                      if (share.includes("25-to-50")) return "25–50%";
                      if (share.includes("50-to-75")) return "50–75%";
                      if (share.includes("75-to-100")) return "75–100%";
                      if (share.includes("more-than-25")) return ">25%";
                      return null;
                    })();
                    const natureSummary = psc.natures_of_control
                      ?.map((n: string) =>
                        n.replace(/-/g, " ").replace(/\b(\w)/g, (c: string) => c.toUpperCase())
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
                          borderBottom: i < pscs.length - 1 ? "1px solid #f1f5f9" : "none",
                          borderLeft: isOffshore ? "3px solid #d97706" : isCorporate ? "3px solid #4f46e5" : "none",
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
          )}

          {/* Director network tab */}
          {activeTab === "director-network" && (
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <span style={CARD_TITLE}>Director Network</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                  Layer 2 cross-reference
                </span>
              </div>
              {appointments.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No director appointment data available
                </div>
              ) : (
                <div style={{ padding: "16px 18px", fontSize: "13px", color: "#475569" }}>
                  Director network data available — {appointments.length} officer{appointments.length !== 1 ? "s" : ""} with appointment data
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div
          style={{
            width: "280px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Company details card */}
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span style={CARD_TITLE}>Company Details</span>
            </div>
            <div
              style={{
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div>
                <div style={LABEL}>Status</div>
                <StatusBadge status={company.company_status} />
              </div>

              <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />

              <div>
                <div style={LABEL}>Incorporated</div>
                <div style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a" }}>
                  {fmtDate(company.date_of_creation)}
                </div>
              </div>

              <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />

              <div>
                <div style={LABEL}>Company Type</div>
                <div style={{ fontSize: "13px", color: "#0f172a" }}>
                  {fmtCompanyType(company.company_type)}
                </div>
              </div>

              {company.registered_office_address && (
                <>
                  <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />
                  <div>
                    <div style={LABEL}>Registered Address</div>
                    <div style={{ fontSize: "13px", color: "#0f172a", lineHeight: "1.6" }}>
                      {fmtAddress(company.registered_office_address)}
                    </div>
                  </div>
                </>
              )}

              {company.jurisdiction && (
                <>
                  <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />
                  <div>
                    <div style={LABEL}>Jurisdiction</div>
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

          {/* Accounts card — placeholder */}
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span style={CARD_TITLE}>Accounts</span>
            </div>
            <div style={{ padding: "16px 18px", fontSize: "13px", color: "#94a3b8" }}>
              Loading...
            </div>
          </div>

          {/* Charges & PSC card — placeholder */}
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span style={CARD_TITLE}>Charges &amp; PSC</span>
            </div>
            <div style={{ padding: "16px 18px", fontSize: "13px", color: "#94a3b8" }}>
              Loading...
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
