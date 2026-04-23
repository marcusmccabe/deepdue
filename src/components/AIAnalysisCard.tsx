"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type {
  AccountsAnalysis,
  FinancialLineItem,
} from "@/lib/analysis-types";

// ── Shared card chrome ────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
  overflow: "hidden",
};

const SECTION_CARD: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  overflow: "hidden",
};

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        backgroundColor: bg,
        color,
        borderRadius: "100px",
        fontSize: "12px",
        fontWeight: "600",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function CardHeader({ badge }: { badge: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "15px 18px",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
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
      {badge}
    </div>
  );
}

// ── Section primitives ────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "13px",
        fontWeight: "700",
        color: "#0f172a",
        padding: "12px 16px",
        borderBottom: "1px solid #e2e8f0",
        backgroundColor: "#f8fafc",
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </div>
  );
}

const MUTED_MARKERS = ["None", "Not disclosed", "Not mentioned"];

function isMuted(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return MUTED_MARKERS.some(
    (m) => trimmed === m || trimmed.toLowerCase().startsWith(m.toLowerCase())
  );
}

function LabelledRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  const muted = typeof value === "string" && isMuted(value);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: "12px",
        padding: "10px 16px",
        borderBottom: "1px solid #f1f5f9",
        alignItems: "start",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: "600",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          paddingTop: "1px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "13px",
          color: muted ? "#94a3b8" : "#0f172a",
          lineHeight: "1.55",
          fontStyle: muted ? "italic" : "normal",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div style={SECTION_CARD}>
      <SectionHeading>{heading}</SectionHeading>
      <div>{children}</div>
    </div>
  );
}

// ── Financial line item (value + yoy) ────────────────────────────────────────

function FinancialLineItemValue({ item }: { item: FinancialLineItem }) {
  const muted = isMuted(item.value);
  const yoy = item.yoyChange ?? "n/a";
  const yoyMuted = !yoy || yoy === "n/a";
  let yoyColor = "#64748b";
  if (!yoyMuted) {
    if (yoy.startsWith("+")) yoyColor = "#059669";
    else if (yoy.startsWith("-")) yoyColor = "#dc2626";
  }
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: "14px",
          fontWeight: "700",
          color: muted ? "#94a3b8" : "#0f172a",
          fontStyle: muted ? "italic" : "normal",
        }}
      >
        {item.value}
      </span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: "600",
          color: yoyMuted ? "#94a3b8" : yoyColor,
          fontStyle: yoyMuted ? "italic" : "normal",
        }}
      >
        {yoy}
      </span>
    </div>
  );
}

// ── Audit opinion badge ───────────────────────────────────────────────────────

function AuditOpinionBadge({ opinion }: { opinion: string }) {
  let color = "#94a3b8";
  let bg = "rgba(148,163,184,0.12)";
  if (opinion === "Clean") {
    color = "#059669";
    bg = "rgba(5,150,105,0.10)";
  } else if (opinion === "Qualified") {
    color = "#d97706";
    bg = "rgba(217,119,6,0.10)";
  } else if (opinion === "Adverse" || opinion === "Disclaimer of opinion") {
    color = "#dc2626";
    bg = "rgba(220,38,38,0.10)";
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "12px",
        fontWeight: "700",
        color,
        backgroundColor: bg,
        padding: "4px 11px",
        borderRadius: "100px",
        border: `1px solid ${color}44`,
      }}
    >
      {opinion}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  companyNumber: string;
}

type Status = "loading" | "success" | "not-found" | "error";

export default function AIAnalysisCard({ companyNumber }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [analysis, setAnalysis] = useState<AccountsAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(
          `/api/analyse-accounts?companyNumber=${encodeURIComponent(companyNumber)}`
        );

        if (cancelled) return;

        if (res.status === 404) {
          setStatus("not-found");
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMsg((data as { error?: string }).error ?? `HTTP ${res.status}`);
          setStatus("error");
          return;
        }

        const data: AccountsAnalysis = await res.json();
        setAnalysis(data);
        setStatus("success");
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(String(err));
          setStatus("error");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [companyNumber]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div style={CARD}>
        <CardHeader badge={<Pill label="Analysing…" color="#4f46e5" bg="rgba(79,70,229,0.08)" />} />
        <div
          style={{
            padding: "40px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              border: "3px solid #e2e8f0",
              borderTop: "3px solid #4f46e5",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a", marginBottom: "6px" }}>
              Analysing filed accounts
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.6" }}>
              Claude is reading the most recent accounts document.
              <br />
              This may take up to 30 seconds.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (status === "not-found") {
    return (
      <div style={CARD}>
        <CardHeader badge={<Pill label="Not available" color="#94a3b8" bg="#f1f5f9" />} />
        <div
          style={{
            padding: "28px 18px",
            textAlign: "center",
            color: "#94a3b8",
            fontSize: "13px",
          }}
        >
          No accounts document found for this company in Companies House.
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div style={CARD}>
        <CardHeader badge={<Pill label="Error" color="#dc2626" bg="rgba(220,38,38,0.08)" />} />
        <div style={{ padding: "18px" }}>
          <div
            style={{
              borderLeft: "3px solid #dc2626",
              backgroundColor: "rgba(220,38,38,0.05)",
              borderRadius: "0 8px 8px 0",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>
              Analysis failed
            </div>
            <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.55" }}>
              {errorMsg || "An unexpected error occurred. Please try refreshing."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (!analysis) return null;

  const fh = analysis.financialHealth;
  const mg = analysis.margins;
  const bs = analysis.balanceSheet;
  const cf = analysis.cashFlowSignals;
  const df = analysis.directorFlags;
  const sd = analysis.strategicDirection;
  const rw = analysis.risksAndWarnings;
  const ao = analysis.auditOpinion;
  const cs = analysis.complianceSignals;

  const cachedBadge = analysis.cached ? (
    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          padding: "3px 8px",
          backgroundColor: "rgba(100,116,139,0.10)",
          color: "#475569",
          borderRadius: "100px",
          fontSize: "11px",
          fontWeight: "600",
          border: "1px solid rgba(100,116,139,0.25)",
          whiteSpace: "nowrap",
        }}
      >
        Cached ·{" "}
        {new Date(analysis.analysedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </span>
    </span>
  ) : (
    <Pill label="✓ Analysis complete" color="#059669" bg="rgba(5,150,105,0.08)" />
  );

  return (
    <div style={CARD}>
      <CardHeader badge={cachedBadge} />

      <div
        style={{
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          backgroundColor: "#f8fafc",
        }}
      >
        {/* ── 1. Financial Health ── */}
        <SectionCard heading="Financial Health">
          <LabelledRow label="Revenue" value={<FinancialLineItemValue item={fh.revenue} />} />
          <LabelledRow
            label="Gross Profit"
            value={<FinancialLineItemValue item={fh.grossProfit} />}
          />
          <LabelledRow
            label="Operating Profit"
            value={<FinancialLineItemValue item={fh.operatingProfit} />}
          />
          <LabelledRow
            label="Net Profit"
            value={<FinancialLineItemValue item={fh.netProfit} />}
          />
          <LabelledRow label="Cash Position" value={fh.cashPosition} />
          <LabelledRow label="Net Assets" value={fh.netAssets} />
        </SectionCard>

        {/* ── 2. Margins & Profitability ── */}
        <SectionCard heading="Margins & Profitability">
          <LabelledRow label="Gross Margin" value={mg.grossMargin} />
          <LabelledRow label="Operating Margin" value={mg.operatingMargin} />
          <LabelledRow label="Trend" value={mg.trend} />
        </SectionCard>

        {/* ── 3. Balance Sheet ── */}
        <SectionCard heading="Balance Sheet">
          <LabelledRow label="Current Ratio" value={bs.currentRatio} />
          <LabelledRow label="Gearing" value={bs.gearing} />
          <LabelledRow label="Asset Write-downs" value={bs.assetWriteDowns} />
        </SectionCard>

        {/* ── 4. Cash Flow ── */}
        <SectionCard heading="Cash Flow">
          <LabelledRow
            label="Profit to Cash Conversion"
            value={cf.profitToCashConversion}
          />
          <LabelledRow label="Capex" value={cf.capex} />
          <LabelledRow label="Summary" value={cf.summary} />
        </SectionCard>

        {/* ── 5. Director & Related Party Flags ── */}
        <SectionCard heading="Director & Related Party Flags">
          <LabelledRow label="Director Loans" value={df.directorLoans} />
          <LabelledRow
            label="Related Party Transactions"
            value={df.relatedPartyTransactions}
          />
          <LabelledRow label="Remuneration Notes" value={df.remunerationNotes} />
        </SectionCard>

        {/* ── 6. Strategic Direction ── */}
        <SectionCard heading="Strategic Direction">
          <LabelledRow label="Management Outlook" value={sd.managementOutlook} />
          <LabelledRow
            label="Markets or Geographies"
            value={sd.marketsOrGeographies}
          />
          <LabelledRow
            label="Acquisitions or Restructuring"
            value={sd.acquisitionsOrRestructuring}
          />
          <LabelledRow label="R&D or Investment" value={sd.rdOrInvestment} />
        </SectionCard>

        {/* ── 7. Risks & Warnings ── */}
        <SectionCard heading="Risks & Warnings">
          <LabelledRow
            label="Explicit Risks"
            value={
              rw.explicitRisks.length === 0 ? (
                <span style={{ color: "#94a3b8", fontStyle: "italic" }}>None stated</span>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {rw.explicitRisks.map((risk, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: "13px",
                        color: "#0f172a",
                        lineHeight: "1.55",
                      }}
                    >
                      {risk}
                    </li>
                  ))}
                </ul>
              )
            }
          />
          <LabelledRow
            label="Material Uncertainties"
            value={rw.materialUncertainties}
          />
          <LabelledRow label="Going Concern" value={rw.goingConcern} />
        </SectionCard>

        {/* ── 8. Audit Opinion ── */}
        <SectionCard heading="Audit Opinion">
          <LabelledRow
            label="Opinion"
            value={<AuditOpinionBadge opinion={ao.opinion} />}
          />
          <LabelledRow label="Qualifications" value={ao.qualifications} />
          <LabelledRow
            label="Auditor Name"
            value={
              ao.auditorName && ao.auditorName.trim().length > 0 ? (
                ao.auditorName
              ) : (
                <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Not disclosed</span>
              )
            }
          />
          <LabelledRow
            label="Auditor Changed"
            value={
              ao.auditorChanged ? (
                <span style={{ fontWeight: "700", color: "#d97706" }}>Yes</span>
              ) : (
                "No"
              )
            }
          />
        </SectionCard>

        {/* ── 9. Compliance Signals ── */}
        <SectionCard heading="Compliance Signals">
          <LabelledRow
            label="Late Filing History"
            value={cs.lateFilingHistory}
          />
          <LabelledRow
            label="Dormancy or Strike-off"
            value={cs.dormancyOrStrikeOff}
          />
          <LabelledRow
            label="Charges Registered"
            value={cs.chargesRegistered}
          />
        </SectionCard>

        {/* ── Footer ── */}
        <div
          style={{
            paddingTop: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            Analysis run{" "}
            {new Date(analysis.analysedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {analysis.cached ? " · Cached result" : " · Cached for 24 hours"}
            {analysis.documentDate && (
              <>
                {" · Accounts filed "}
                {new Date(analysis.documentDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </>
            )}
          </span>

          <Link
            href={`/company/${companyNumber}/financials`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px 18px",
              backgroundColor: "#4f46e5",
              color: "#ffffff",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "700",
              letterSpacing: "0.01em",
              textDecoration: "none",
            }}
          >
            View Full Financials →
          </Link>
        </div>
      </div>
    </div>
  );
}
