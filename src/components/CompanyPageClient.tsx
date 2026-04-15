"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import CompanyTabs, { type TabId } from "@/components/CompanyTabs";
import type { AccountsAnalysis } from "@/lib/analysis-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `£${(value / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000) return `£${(value / 1_000).toFixed(1)}k`;
  return `£${value.toLocaleString("en-GB")}`;
}

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

function SkeletonBlock({ height = 20, width = "100%" }: { height?: number; width?: string | number }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: "6px",
        backgroundColor: "#e2e8f0",
        animation: "skeletonPulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompanyPageClient({
  company,
}: {
  company: any;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [analysis, setAnalysis] = useState<AccountsAnalysis | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/analyse-accounts?companyNumber=${encodeURIComponent(
        company.company_number
      )}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setAnalysis(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [company.company_number]);

  const snap = analysis?.financialSnapshot;

  const snapMetrics = [
    { label: "Revenue", value: snap?.revenue },
    { label: "Gross Profit", value: snap?.grossProfit },
    { label: "Operating Profit", value: snap?.operatingProfit },
    { label: "Cash", value: snap?.cash },
    { label: "Net Assets", value: snap?.netAssets },
    { label: "Employees", value: snap?.employeeCount, isCount: true },
  ];

  return (
    <>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>

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
              {/* Financial snapshot card */}
              <div style={CARD}>
                <div style={CARD_HEADER}>
                  <span style={CARD_TITLE}>Financial Snapshot</span>
                </div>
                <div style={{ padding: "16px 18px" }}>
                  {analysis === null ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "10px",
                      }}
                    >
                      {snapMetrics.map((m) => (
                        <div
                          key={m.label}
                          style={{
                            backgroundColor: "#f8fafc",
                            borderRadius: "8px",
                            padding: "12px",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ ...LABEL, marginBottom: "8px" }}>
                            {m.label}
                          </div>
                          <SkeletonBlock height={20} width="70%" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "10px",
                      }}
                    >
                      {snapMetrics.map((m) => (
                        <div
                          key={m.label}
                          style={{
                            backgroundColor: "#f8fafc",
                            borderRadius: "8px",
                            padding: "12px",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={LABEL}>{m.label}</div>
                          <div
                            style={{
                              fontSize: "15px",
                              fontWeight: "800",
                              color:
                                m.value == null
                                  ? "#cbd5e1"
                                  : !m.isCount && (m.value as number) < 0
                                  ? "#dc2626"
                                  : "#0f172a",
                              lineHeight: "1.2",
                            }}
                          >
                            {m.value == null
                              ? "—"
                              : m.isCount
                              ? (m.value as number).toLocaleString("en-GB")
                              : fmtCurrency(m.value as number)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Items for attention card */}
              <div style={CARD}>
                <div style={CARD_HEADER}>
                  <span style={CARD_TITLE}>Items for Attention</span>
                </div>
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {analysis === null ? (
                    <>
                      <SkeletonBlock height={56} />
                      <SkeletonBlock height={56} />
                    </>
                  ) : (analysis?.itemsForAttention ?? []).length === 0 ? (
                    <div style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>
                      No items flagged for attention.
                    </div>
                  ) : (
                    <>
                      {(analysis.itemsForAttention as { heading: string; detail: string }[]).map(
                        (item, i) => (
                          <div
                            key={i}
                            style={{
                              borderLeft: "4px solid #d97706",
                              backgroundColor: "rgba(217,119,6,0.05)",
                              borderRadius: "0 8px 8px 0",
                              padding: "12px 14px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: "700",
                                color: "#92400e",
                                marginBottom: "4px",
                              }}
                            >
                              {item.heading}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#78350f",
                                lineHeight: "1.55",
                              }}
                            >
                              {item.detail}
                            </div>
                          </div>
                        )
                      )}
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#94a3b8",
                          marginTop: "4px",
                        }}
                      >
                        Have a question? Click Ask AI to chat about these accounts.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* All other tabs — coming soon */}
          {activeTab !== "overview" && (
            <div style={{ padding: "24px", color: "grey" }}>Coming soon</div>
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
