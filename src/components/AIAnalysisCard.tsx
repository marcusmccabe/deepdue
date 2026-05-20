"use client";

import { useState, useEffect, useRef } from "react";
import type { AccountsAnalysis } from "@/lib/analysis-types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FilingItem {
  date?: string;
  type?: string;
  transaction_id?: string;
  links?: { document_metadata?: string };
}

type Tone = "green" | "amber" | "red" | "neutral" | "blue";

// ── Design tokens ─────────────────────────────────────────────────────────────

const INDIGO       = "#534AB7";
const INDIGO_BG    = "#EEEDFE";
const INDIGO_BORD  = "#AFA9EC";
const INDIGO_DARK  = "#3C3489";

// ── Tone palette ──────────────────────────────────────────────────────────────

const TONE: Record<Tone, { bg: string; text: string; border: string }> = {
  green:   { bg: "#EAF3DE", text: "#3B6D11", border: "#97C459"  },
  amber:   { bg: "#FAEEDA", text: "#854F0B", border: "#EF9F27"  },
  red:     { bg: "#FCEBEB", text: "#A32D2D", border: "#F09595"  },
  blue:    { bg: "#E6F1FB", text: "#185FA5", border: "#93C5FD"  },
  neutral: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MUTED_MARKERS = ["None", "Not disclosed", "Not mentioned"];
function isMuted(v: string | undefined): boolean {
  if (!v) return false;
  const t = v.trim();
  return MUTED_MARKERS.some(m => t === m || t.toLowerCase().startsWith(m.toLowerCase()));
}

function classifyTone(txt?: string): Tone {
  const v = (txt ?? "").toLowerCase();
  if (/high|adverse|qualified|disclaimer|weak|poor/.test(v)) return "red";
  if (/medium|moderate|adequate|watch/.test(v)) return "amber";
  if (/low|good|clean|strong|credible|on.?time/.test(v)) return "green";
  if (/confident/.test(v)) return "blue";
  return "neutral";
}

function truncate(text: string | undefined, n: number): string {
  if (!text) return "";
  const t = text.trim();
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
}

function accountsTypeLabel(type?: string): string {
  switch (type) {
    case "AA":     return "Full";
    case "AAMD":   return "Full";
    case "AA01":   return "Abbreviated";
    case "LLAA":   return "Full";
    case "LLAAMD": return "Full";
    case "LLAA01": return "Abbreviated";
    default:       return "Accounts";
  }
}

function fmtFilingDate(date?: string): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

// ── SVG icon paths (Tabler-style, 24×24 viewBox) ─────────────────────────────

const P = {
  trendingUp: (
    <>
      <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
      <polyline points="16,7 22,7 22,13" />
    </>
  ),
  trendingDown: (
    <>
      <polyline points="22,17 13.5,8.5 8.5,13.5 2,7" />
      <polyline points="16,17 22,17 22,11" />
    </>
  ),
  bank: (
    <>
      <path d="M3 21h18" /><path d="M3 10h18" /><path d="M5 6l7-3 7 3" />
      <rect x="5"  y="14" width="3" height="7" />
      <rect x="10.5" y="14" width="3" height="7" />
      <rect x="16" y="14" width="3" height="7" />
    </>
  ),
  message: (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  certificate: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M9.5 14.5l-1.5 5.5 4-2 4 2-1.5-5.5" />
    </>
  ),
  exchange: (
    <>
      <path d="M7 16V5m0 0L4 8m3-3 3 3" />
      <path d="M17 8v11m0 0 3-3m-3 3-3-3" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9"  x2="12"    y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </>
  ),
  heartbeat: <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />,
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  alertCircle: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8"  x2="12"    y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  chartLine: (
    <>
      <polyline points="3,17 9,11 13,15 21,7" />
      <polyline points="14,7 21,7 21,14" />
    </>
  ),
  building: (
    <>
      <path d="M3 21V9l9-6 9 6v12" />
      <rect x="9"  y="14" width="6" height="7" />
      <rect x="5"  y="10" width="3" height="3" />
      <rect x="16" y="10" width="3" height="3" />
    </>
  ),
  fileDesc: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  file: (
    <>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13,2 13,9 20,9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8"  x2="12"    y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
};

function Icon({
  icon,
  size = 14,
  color = "currentColor",
  strokeWidth = 2,
}: {
  icon: React.ReactNode;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {icon}
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionIconBox({
  bg,
  iconColor,
  icon,
}: {
  bg: string;
  iconColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: "26px",
        height: "26px",
        borderRadius: "6px",
        backgroundColor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon icon={icon} size={14} color={iconColor} />
    </div>
  );
}

function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  const s = TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 9px",
        backgroundColor: s.bg,
        color: s.text,
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: "500",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function SignalBar({ tone }: { tone: Tone }) {
  const map: Record<Tone, { bar: string; width: string }> = {
    red:     { bar: "#E24B4A", width: "80%" },
    amber:   { bar: "#EF9F27", width: "55%" },
    green:   { bar: "#97C459", width: "85%" },
    blue:    { bar: "#60A5FA", width: "70%" },
    neutral: { bar: "#CBD5E1", width: "40%" },
  };
  const { bar, width } = map[tone];
  return (
    <div
      style={{
        height: "3px",
        background: "#f1f5f9",
        borderRadius: "2px",
        marginTop: "7px",
      }}
    >
      <div
        style={{
          height: "100%",
          width,
          background: bar,
          borderRadius: "2px",
          transition: "width 0.5s ease",
        }}
      />
    </div>
  );
}

function CitationMarker({
  id,
  num,
  section,
  page,
  verbatim,
  activeCitation,
  setActiveCitation,
}: {
  id: string;
  num: number;
  section: string;
  page: string;
  verbatim: string;
  activeCitation: string | null;
  setActiveCitation: (id: string | null) => void;
}) {
  const active = activeCitation === id;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        onMouseEnter={() => setActiveCitation(id)}
        onMouseLeave={() => setActiveCitation(null)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "15px",
          height: "15px",
          borderRadius: "50%",
          backgroundColor: INDIGO_BG,
          color: INDIGO,
          border: `0.5px solid ${INDIGO_BORD}`,
          fontSize: "9px",
          fontWeight: "500",
          cursor: "default",
          userSelect: "none",
          verticalAlign: "super",
          lineHeight: "1",
          marginLeft: "2px",
        }}
      >
        {num}
      </span>
      {active && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "260px",
            backgroundColor: "#fff",
            border: "0.5px solid #e2e8f0",
            borderRadius: "8px",
            padding: "10px 12px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: INDIGO,
              fontWeight: "500",
              marginBottom: "5px",
            }}
          >
            {section} · {page}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
            {verbatim}
          </div>
        </div>
      )}
    </span>
  );
}

function renderWithCitations(
  text: string,
  citations: Array<{ section: string; page: string; verbatim: string }>,
  activeCitation: string | null,
  setActiveCitation: (id: string | null) => void,
  prefix: string
): React.ReactNode {
  if (!text || citations.length === 0) return text;
  const moneyRe = /£[\d,]+(?:\.\d+)?(?:\s*(?:million|m|bn|billion|k|thousand))?/gi;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let citIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = moneyRe.exec(text)) !== null && citIdx < citations.length) {
    const end = m.index + m[0].length;
    nodes.push(text.slice(lastIdx, end));
    const c = citations[citIdx];
    nodes.push(
      <CitationMarker
        key={`${prefix}-${citIdx}`}
        id={`${prefix}-${citIdx}`}
        num={citIdx + 1}
        section={c.section}
        page={c.page}
        verbatim={c.verbatim}
        activeCitation={activeCitation}
        setActiveCitation={setActiveCitation}
      />
    );
    lastIdx = end;
    citIdx++;
  }
  nodes.push(text.slice(lastIdx));
  return <>{nodes}</>;
}

function FilingPill({
  filing,
  isActive,
  isLoading,
  onClick,
}: {
  filing: FilingItem;
  isActive: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "4px 10px",
        borderRadius: "20px",
        border: isActive ? `1px solid ${INDIGO}` : "1px solid #e2e8f0",
        backgroundColor: isActive ? INDIGO_BG : "#fff",
        color: isActive ? INDIGO_DARK : "#64748b",
        fontSize: "12px",
        fontWeight: isActive ? "500" : "400",
        cursor: isLoading ? "wait" : "pointer",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        lineHeight: "1.4",
      }}
    >
      <Icon icon={P.file} size={12} color={isActive ? INDIGO : "#94a3b8"} />
      <span>{fmtFilingDate(filing.date)}</span>
      <span style={{ color: isActive ? INDIGO : "#cbd5e1" }}>·</span>
      <span>{accountsTypeLabel(filing.type)}</span>
      {isLoading && isActive && (
        <span
          style={{
            width: "10px",
            height: "10px",
            border: `2px solid ${INDIGO_BG}`,
            borderTop: `2px solid ${INDIGO}`,
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.6s linear infinite",
            marginLeft: "2px",
          }}
        />
      )}
    </button>
  );
}

function KVRow({ label, value }: { label: string; value?: string }) {
  if (!value || isMuted(value)) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr",
        gap: "10px",
        padding: "6px 0",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: "500",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          paddingTop: "2px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "13px", color: "#334155", lineHeight: "1.6" }}>
        {value}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      className="acc-chevron"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 2 8 6 4 10" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  companyNumber: string;
  companyName?: string;
  directorAppointments?: Record<string, any[]>;
}

type Status = "loading" | "success" | "not-found" | "error";

export default function AIAnalysisCard({
  companyNumber,
  companyName,
  directorAppointments,
}: Props) {
  // ── Analysis state ────────────────────────────────────────────────────────
  const [status, setStatus] = useState<Status>("loading");
  const [analysis, setAnalysis] = useState<AccountsAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [openSections, setOpenSections] = useState<string[]>(["financial"]);

  // ── Filing pills state ────────────────────────────────────────────────────
  const [filings, setFilings] = useState<FilingItem[]>([]);
  const [activeFilingId, setActiveFilingId] = useState<string | null>(null);
  const [pillLoading, setPillLoading] = useState(false);

  // ── Ask AI state ──────────────────────────────────────────────────────────
  const [question, setQuestion]     = useState("");
  const [isAsking, setIsAsking]     = useState(false);
  const [answer, setAnswer]         = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [inputFocused, setInputFocused] = useState(false);

  // ── Citation hover state ──────────────────────────────────────────────────
  const [activeCitation, setActiveCitation] = useState<string | null>(null);

  // ── Refs for stale-closure fix ────────────────────────────────────────────
  const analysisRef = useRef<AccountsAnalysis | null>(null);
  const chatHistoryRef = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => { analysisRef.current = analysis; }, [analysis]);
  useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);

  // ── Fetch analysis on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(
          `/api/analyse-accounts?companyNumber=${encodeURIComponent(companyNumber)}`
        );
        if (cancelled) return;
        if (res.status === 404) { setStatus("not-found"); return; }
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
        if (!cancelled) { setErrorMsg(String(err)); setStatus("error"); }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [companyNumber]);

  // ── Fetch filing history for pills ───────────────────────────────────────
  useEffect(() => {
    async function fetchFilings() {
      try {
        const res = await fetch(
          `/api/accounts-filings?companyNumber=${encodeURIComponent(companyNumber)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const items: FilingItem[] = data.items ?? [];
        setFilings(items);
        if (items.length > 0 && items[0].transaction_id) {
          setActiveFilingId(items[0].transaction_id);
        }
      } catch {
        // silently ignore — pills simply won't render
      }
    }
    fetchFilings();
  }, [companyNumber]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleSection = (id: string) => {
    setOpenSections(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAsk = async (q?: string) => {
    const queryText = q ?? question;
    if (!queryText.trim() || isAsking) return;
    setIsAsking(true);
    setQuestion("");
    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: queryText,
          companyName: companyName ?? "",
          companyNumber: companyNumber ?? "",
          analysisContext: JSON.stringify(analysisRef.current),
          companyContext: { directorAppointments: directorAppointments ?? {} },
          chatHistory: chatHistoryRef.current,
        }),
      });
      const data = await res.json();
      if (data.answer) {
        setAnswer(data.answer);
        setChatHistory(prev => [
          ...prev,
          { role: "user", content: queryText },
          { role: "assistant", content: data.answer },
        ]);
      }
    } catch {
      setAnswer("Sorry, something went wrong. Please try again.");
    } finally {
      setIsAsking(false);
    }
  };

  const handlePillClick = async (filing: FilingItem) => {
    if (pillLoading) return;
    if (!filing.transaction_id) return;
    if (filing.transaction_id === activeFilingId) return;
    setActiveFilingId(filing.transaction_id);
    setPillLoading(true);
    setStatus("loading");
    setAnswer(null);
    setChatHistory([]);
    try {
      const res = await fetch(
        `/api/analyse-accounts?companyNumber=${encodeURIComponent(companyNumber)}&transactionId=${encodeURIComponent(filing.transaction_id)}`
      );
      if (!res.ok) { setStatus("error"); return; }
      const data: AccountsAnalysis = await res.json();
      setAnalysis(data);
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setPillLoading(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "40px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              border: "3px solid #e2e8f0",
              borderTop: `3px solid ${INDIGO}`,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a", marginBottom: "5px" }}>
              Analysing filed accounts
            </div>
            <div style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.6" }}>
              Reading the most recent accounts document.
              <br />
              This may take up to 30 seconds.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Not found state ───────────────────────────────────────────────────────
  if (status === "not-found") {
    return (
      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "28px 18px",
          textAlign: "center",
          color: "#94a3b8",
          fontSize: "13px",
        }}
      >
        No accounts document found for this company in Companies House.
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "18px",
        }}
      >
        <div
          style={{
            borderLeft: "3px solid #dc2626",
            backgroundColor: "rgba(220,38,38,0.04)",
            borderRadius: "0 8px 8px 0",
            padding: "12px 14px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a", marginBottom: "4px" }}>
            Analysis failed
          </div>
          <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.55" }}>
            {errorMsg || "An unexpected error occurred. Please try refreshing."}
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  // ── New progressive-disclosure layout (executiveSummary present) ──────────
  if (analysis.executiveSummary) {
    const fp   = analysis.financialPerformance;
    const bs   = analysis.balanceSheetStrength;
    const cp   = analysis.cashPosition;
    const mc   = analysis.managementCommentary;
    const ag   = analysis.auditorAndGoingConcern;
    const rp   = analysis.relatedPartyTransactions;
    const fb   = analysis.filingBehaviour;
    const kr   = analysis.keyRisks;
    const sd   = analysis.strategicDirection as
      | { summary?: string; initiatives?: string[]; outlook?: string }
      | undefined;
    const ca   = analysis.creditAssessment;
    const flags = analysis.redFlags ?? [];

    // ── Signal pill derivations ─────────────────────────────────────────────

    const ratingText  = (ca?.overallRating ?? "").toLowerCase();
    const creditLabel = ratingText.includes("high") ? "High"
      : ratingText.includes("low") ? "Low"
      : ratingText ? "Medium"
      : "—";
    const creditTone = classifyTone(creditLabel);

    const cashSummary = (cp?.summary ?? "").toLowerCase();
    const cashLabel   = /weak|tight|stretched|insufficient|risk|concern|thin/.test(cashSummary)
      ? "Weak"
      : /good|strong|healthy|robust/.test(cashSummary)
      ? "Good"
      : cashSummary ? "Adequate" : "—";
    const cashTone = classifyTone(cashLabel);

    const dirCount = rp?.transactions?.length ?? 0;
    const dirLabel = dirCount === 0 ? "Low" : dirCount > 2 ? "High" : "Medium";
    const dirTone  = classifyTone(dirLabel);

    const opinion   = ag?.auditOpinion ?? "";
    const auditLabel: string = ag?.goingConcernFlag ? "Going concern" : opinion || "—";
    const auditTone: Tone = ag?.goingConcernFlag ? "red"
      : /qualified|adverse|disclaimer/i.test(opinion) ? "red"
      : /clean|unqualified/i.test(opinion) ? "green"
      : "neutral";

    const signalPills = [
      { label: "Credit risk",   value: creditLabel, tone: creditTone },
      { label: "Cash health",   value: cashLabel,   tone: cashTone   },
      { label: "Director risk", value: dirLabel,    tone: dirTone    },
      { label: "Audit opinion", value: auditLabel,  tone: auditTone  },
    ];

    // ── Accordion section status ─────────────────────────────────────────────

    const fpStatus = truncate(fp?.yearOnYearTrend, 30);
    const fpTone   = classifyTone(fpStatus);
    const fpIsDown = /deteriorat|declin|decreas|reduc|fall/i.test(fpStatus);

    const bsStatus = truncate(bs?.summary || cp?.summary, 40);
    const bsTone   = classifyTone(bsStatus);

    const mcNeg    = !!mc?.assessment && /concern|risk|weak|issue|negative|caution|flag|deteriorat/i.test(mc.assessment);
    const mcStatus = mc ? (mcNeg ? "Concerns noted" : "Credible") : "—";
    const mcTone: Tone = mcNeg ? "amber" : "green";

    const agIssues = !!(ag?.goingConcernFlag || /qualified|adverse|disclaimer/i.test(opinion));
    const agStatus = ag ? (agIssues ? "Issues noted" : "Clean") : "—";
    const agTone: Tone = agIssues ? "red" : "green";

    const rpFig    = rp?.summary?.match(/£[\d.,]+\s*(?:m|million|bn|billion|k)?/i)?.[0];
    const rpStatus = dirCount === 0 ? "None" : rpFig ? `Significant — ${rpFig}` : `${dirCount} disclosed`;
    const rpTone: Tone = dirCount === 0 ? "green" : "amber";

    const krCount  = kr?.risks?.length ?? 0;
    const krStatus = krCount > 0 ? `${krCount} identified` : "None identified";
    const krTone: Tone = krCount === 0 ? "green" : krCount > 3 ? "red" : "amber";

    const sdOutlook = sd?.outlook ?? "";
    const sdStatus  = /diversif/i.test(sdOutlook) ? "Diversifying"
      : sdOutlook ? truncate(sdOutlook.split(/[.!?]/)[0], 30) : "—";
    const sdTone: Tone = classifyTone(sdStatus);

    const fbStatus = [fb?.accountsType, fb?.accountsMadeUpTo]
      .filter((x): x is string => !!x && !isMuted(x))
      .join(" · ") || "—";

    // ── Citation data ─────────────────────────────────────────────────────────

    const execCitations = [
      {
        section: "Strategic report",
        page: "p.3",
        verbatim: fp?.revenueGrowth || "Revenue figures from the profit and loss account.",
      },
      {
        section: "Profit & loss account",
        page: "p.8",
        verbatim: fp?.marginAnalysis || "Profit figures from the income statement.",
      },
      {
        section: "Principal risks",
        page: "p.6",
        verbatim: kr?.summary || ca?.keyConcerns?.[0] || "Risk statement from the strategic report.",
      },
    ];

    const fpCitations = [
      { section: "Strategic report",     page: "p.3",  verbatim: fp?.revenueGrowth    || "Revenue from filed accounts." },
      { section: "Profit & loss account", page: "p.8", verbatim: fp?.marginAnalysis   || "Profit figures from filed accounts." },
    ];
    const bsCitations = [
      { section: "Balance sheet",         page: "p.10", verbatim: bs?.assets  || "Asset figures from balance sheet." },
      { section: "Balance sheet",         page: "p.10", verbatim: bs?.debt    || "Liability figures from balance sheet." },
    ];
    const krCitations = [
      { section: "Principal risks",       page: "p.6",  verbatim: kr?.risks?.[0] || "Risk statement from filed accounts." },
    ];

    // ── Accordion row renderer ─────────────────────────────────────────────

    const renderRow = (
      id: string,
      title: string,
      iconBg: string,
      iconColor: string,
      icon: React.ReactNode,
      statusLabel: string,
      statusTone: Tone,
      body: React.ReactNode
    ) => {
      const open = openSections.includes(id);
      return (
        <div key={id} className={`acc-row ${open ? "open" : ""}`}>
          <button
            type="button"
            className="acc-header"
            onClick={() => toggleSection(id)}
            aria-expanded={open}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
              <SectionIconBox bg={iconBg} iconColor={iconColor} icon={icon} />
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a" }}>
                {title}
              </span>
            </div>
            <div style={{ flex: "0 0 auto" }} />
            <StatusChip label={statusLabel} tone={statusTone} />
            <Chevron />
          </button>
          <div className="acc-content">
            <div className="acc-content-inner">
              <div className="acc-content-body">{body}</div>
            </div>
          </div>
        </div>
      );
    };

    // ── Ask AI suggested questions ─────────────────────────────────────────

    const SUGGESTED = [
      { q: "What is the overall financial health of this company?",           iconBg: "#FAEEDA", iconColor: "#854F0B", icon: P.heartbeat  },
      { q: "Who are the directors and what other companies are they in?",     iconBg: "#E6F1FB", iconColor: "#185FA5", icon: P.user       },
      { q: "Are there any outstanding charges or red flags?",                 iconBg: "#FCEBEB", iconColor: "#A32D2D", icon: P.alertCircle },
      { q: "How has financial performance changed over the last 3 years?",    iconBg: "#EAF3DE", iconColor: "#3B6D11", icon: P.chartLine  },
      { q: "Who are the beneficial owners and group structure?",              iconBg: INDIGO_BG, iconColor: INDIGO,    icon: P.building   },
      { q: "Summarise the most significant recent filings",                   iconBg: "#F1F5F9", iconColor: "#64748b", icon: P.fileDesc   },
    ];

    // ── Displayed filing pills (max 4 + "N more") ──────────────────────────

    const displayedFilings = filings.slice(0, 4);
    const extraCount       = filings.length > 4 ? filings.length - 4 : 0;

    // ── Context label for Ask AI footer ───────────────────────────────────

    const contextLabel = fb?.accountsMadeUpTo
      ? `${fb.accountsMadeUpTo} accounts`
      : analysis.documentDate
      ? `${fmtFilingDate(analysis.documentDate)} accounts`
      : "Latest accounts";

    return (
      <div className="space-y-3">

        {/* ── Compact header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "22px",
                height: "22px",
                backgroundColor: INDIGO,
                borderRadius: "5px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="white" aria-hidden="true">
                <path d="M6 1l1.4 3.1L11 5l-2.5 2.4.6 3.6L6 9.3l-3.1 1.7.6-3.6L1 5l3.6-.9z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a", lineHeight: "1.3" }}>
                AI Document Intelligence
              </div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "500",
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginTop: "1px",
                }}
              >
                Extracted from filed accounts
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "500",
              color: "#3B6D11",
              backgroundColor: "#EAF3DE",
              padding: "3px 10px",
              borderRadius: "100px",
            }}
          >
            ✓ Analysis complete
          </span>
        </div>

        {/* ── Source document pills ── */}
        {displayedFilings.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              alignItems: "center",
            }}
          >
            {displayedFilings.map(f => (
              <FilingPill
                key={f.transaction_id ?? f.date}
                filing={f}
                isActive={activeFilingId === f.transaction_id}
                isLoading={pillLoading && activeFilingId === f.transaction_id}
                onClick={() => handlePillClick(f)}
              />
            ))}
            {extraCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  color: "#94a3b8",
                  fontSize: "12px",
                  fontWeight: "400",
                  whiteSpace: "nowrap",
                }}
              >
                +{extraCount} more
              </span>
            )}
          </div>
        )}

        {/* ── Signal cards (4 across) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
          {signalPills.map(p => {
            const ts = TONE[p.tone];
            return (
              <div
                key={p.label}
                style={{
                  backgroundColor: ts.bg,
                  border: `1px solid ${ts.border}`,
                  borderRadius: "8px",
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "500",
                    color: ts.text,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: "2px",
                    opacity: 0.85,
                  }}
                >
                  {p.label}
                </div>
                <div style={{ fontSize: "13px", fontWeight: "500", color: ts.text }}>
                  {p.value}
                </div>
                <SignalBar tone={p.tone} />
              </div>
            );
          })}
        </div>

        {/* ── Executive summary ── */}
        <div
          style={{
            borderLeft: `2px solid ${INDIGO}`,
            backgroundColor: "#f8fafc",
            borderRadius: "0 8px 8px 0",
            padding: "14px 16px",
            overflow: "visible",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: "500",
              color: INDIGO,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "7px",
            }}
          >
            Executive Summary
          </div>
          <p style={{ fontSize: "13px", color: "#334155", lineHeight: "1.75", margin: 0 }}>
            {renderWithCitations(
              analysis.executiveSummary,
              execCitations,
              activeCitation,
              setActiveCitation,
              "exec"
            )}
          </p>
        </div>

        {/* ── Red flags ── */}
        {flags.length > 0 && (
          <div
            style={{
              backgroundColor: "#FCEBEB",
              border: "1px solid #F09595",
              borderRadius: "8px",
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <Icon icon={P.alertTriangle} size={15} color="#A32D2D" />
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#A32D2D" }}>Red flags</span>
            </div>
            <ul style={{ margin: "0 0 0 22px", listStyle: "disc", color: "#7a2424" }}>
              {flags.map((f, i) => (
                <li key={i} style={{ fontSize: "13px", lineHeight: "1.6", marginBottom: "2px" }}>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Accordion sections ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>

          {fp && renderRow(
            "financial",
            "Financial performance",
            "#FAEEDA", "#854F0B",
            fpIsDown ? P.trendingDown : P.trendingUp,
            fpStatus || "—",
            fpTone,
            <>
              {fp.summary && !isMuted(fp.summary) && (
                <p style={{ marginBottom: "10px", color: "#334155", fontSize: "13px" }}>
                  {renderWithCitations(fp.summary, fpCitations, activeCitation, setActiveCitation, "fp-s")}
                </p>
              )}
              <KVRow label="Revenue growth"  value={fp.revenueGrowth} />
              <KVRow label="Margin analysis" value={fp.marginAnalysis} />
              <KVRow label="YoY trend"       value={fp.yearOnYearTrend} />
            </>
          )}

          {(bs || cp) && renderRow(
            "balance",
            "Balance sheet & cash",
            "#EAF3DE", "#3B6D11",
            P.bank,
            bsStatus || "—",
            bsTone,
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "500",
                    color: INDIGO,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: "6px",
                  }}
                >
                  Balance sheet
                </div>
                {bs?.summary && !isMuted(bs.summary) && (
                  <p style={{ marginBottom: "8px", color: "#334155", fontSize: "13px" }}>
                    {renderWithCitations(bs.summary, bsCitations, activeCitation, setActiveCitation, "bs-s")}
                  </p>
                )}
                <KVRow label="Assets"          value={bs?.assets} />
                <KVRow label="Debt"            value={bs?.debt} />
                <KVRow label="Working capital" value={bs?.workingCapital} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "500",
                    color: INDIGO,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: "6px",
                  }}
                >
                  Cash
                </div>
                {cp?.summary && !isMuted(cp.summary) && (
                  <p style={{ marginBottom: "8px", color: "#334155", fontSize: "13px" }}>
                    {cp.summary}
                  </p>
                )}
                <KVRow label="Cash & equivalents" value={cp?.cashAndEquivalents} />
                <KVRow label="Cash conversion"    value={cp?.cashConversion} />
                <KVRow label="Liquidity risk"     value={cp?.liquidityRisk} />
              </div>
            </div>
          )}

          {mc && renderRow(
            "management",
            "Management commentary",
            "#EAF3DE", "#3B6D11",
            P.message,
            mcStatus,
            mcTone,
            <>
              {mc.summary && !isMuted(mc.summary) && (
                <p style={{ marginBottom: "10px", color: "#334155", fontSize: "13px" }}>
                  {mc.summary}
                </p>
              )}
              {mc.keyThemes && mc.keyThemes.length > 0 && (
                <ul style={{ margin: "0 0 10px 18px", listStyle: "disc", color: "#475569" }}>
                  {mc.keyThemes.map((t, i) => (
                    <li key={i} style={{ marginBottom: "3px", fontSize: "13px" }}>{t}</li>
                  ))}
                </ul>
              )}
              {mc.assessment && !isMuted(mc.assessment) && (
                <div
                  style={{
                    backgroundColor: "#F5F5FF",
                    border: "1px solid #C7C7F0",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    fontStyle: "italic",
                    color: "#3D3D9E",
                    fontSize: "13px",
                  }}
                >
                  {mc.assessment}
                </div>
              )}
            </>
          )}

          {ag && renderRow(
            "auditor",
            "Auditor & going concern",
            "#EAF3DE", "#3B6D11",
            P.certificate,
            agStatus,
            agTone,
            <>
              <KVRow label="Auditor"  value={ag.auditorName} />
              <KVRow label="Opinion"  value={ag.auditOpinion} />
              <div style={{ padding: "6px 0" }}>
                {ag.goingConcernFlag ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "#A32D2D", fontSize: "13px" }}>
                    <Icon icon={P.alertTriangle} size={15} color="#A32D2D" />
                    <span>
                      <strong>Going concern issue raised.</strong>
                      {ag.goingConcernDetail && !isMuted(ag.goingConcernDetail)
                        ? ` ${ag.goingConcernDetail}`
                        : ""}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#3B6D11", fontSize: "13px" }}>
                    <span aria-hidden="true">✓</span>
                    <span>No going concern issues noted.</span>
                  </div>
                )}
              </div>
              <KVRow label="Emphasis of matter" value={ag.emphasisOfMatter} />
            </>
          )}

          {rp && renderRow(
            "related",
            "Related party transactions",
            "#FAEEDA", "#854F0B",
            P.exchange,
            rpStatus,
            rpTone,
            <>
              {rp.summary && !isMuted(rp.summary) && (
                <p style={{ marginBottom: "10px", color: "#334155", fontSize: "13px" }}>
                  {rp.summary}
                </p>
              )}
              {rp.transactions && rp.transactions.length > 0 ? (
                <ul style={{ margin: "0 0 10px 18px", listStyle: "disc", color: "#475569" }}>
                  {rp.transactions.map((t, i) => (
                    <li key={i} style={{ marginBottom: "3px", fontSize: "13px" }}>{t}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "13px" }}>
                  None disclosed in these accounts.
                </p>
              )}
              {rp.assessment && !isMuted(rp.assessment) && (
                <p style={{ color: "#334155", fontSize: "13px" }}>{rp.assessment}</p>
              )}
            </>
          )}

          {kr && renderRow(
            "risks",
            "Key risks",
            "#FCEBEB", "#A32D2D",
            P.alertTriangle,
            krStatus,
            krTone,
            <>
              {kr.summary && !isMuted(kr.summary) && (
                <p style={{ marginBottom: "10px", color: "#334155", fontSize: "13px" }}>
                  {renderWithCitations(kr.summary, krCitations, activeCitation, setActiveCitation, "kr-s")}
                </p>
              )}
              {kr.risks && kr.risks.length > 0 ? (
                <div>
                  {kr.risks.map((r, i) => {
                    const isHigh = /\bhigh\b|\bcritical\b|\bsignificant\b|\bsubstantial\b/i.test(r);
                    const labelColor = isHigh ? "#A32D2D" : "#BA7517";
                    return (
                      <div
                        key={i}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "150px 1fr",
                          gap: "10px",
                          padding: "6px 0",
                          borderBottom: i < kr.risks!.length - 1 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "500",
                            color: labelColor,
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            paddingTop: "2px",
                          }}
                        >
                          {isHigh ? "High" : "Medium"}
                        </div>
                        <div style={{ fontSize: "13px", color: "#334155", lineHeight: "1.6" }}>
                          {r}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "13px" }}>
                  No specific risks identified.
                </p>
              )}
            </>
          )}

          {sd && renderRow(
            "strategic",
            "Strategic direction",
            "#E6F1FB", "#185FA5",
            P.compass,
            sdStatus,
            sdTone,
            <>
              {sd.summary && !isMuted(sd.summary) && (
                <p style={{ marginBottom: "10px", color: "#334155", fontSize: "13px" }}>
                  {sd.summary}
                </p>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "500",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: "6px",
                    }}
                  >
                    Initiatives
                  </div>
                  {sd.initiatives && sd.initiatives.length > 0 ? (
                    <ul style={{ margin: "0 0 0 18px", listStyle: "disc", color: "#475569" }}>
                      {sd.initiatives.map((item, ix) => (
                        <li key={ix} style={{ marginBottom: "2px", fontSize: "13px" }}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "13px" }}>None mentioned</p>
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "500",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: "6px",
                    }}
                  >
                    Outlook
                  </div>
                  <p style={{ color: "#334155", fontSize: "13px" }}>
                    {sd.outlook || "Not stated"}
                  </p>
                </div>
              </div>
            </>
          )}

          {fb && renderRow(
            "filing",
            "Filing behaviour",
            "#f8fafc", "#94a3b8",
            P.calendar,
            fbStatus,
            "neutral",
            <>
              <KVRow label="Made up to"    value={fb.accountsMadeUpTo} />
              <KVRow label="Accounts type" value={fb.accountsType} />
              <KVRow label="Filing pattern" value={fb.filingPattern} />
            </>
          )}

        </div>

        {/* ── Ask AI — three-zone redesign ── */}
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          {/* Zone 1: input area */}
          <div style={{ padding: "20px", backgroundColor: "#f8fafc" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: "500",
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: "3px",
              }}
            >
              Ask AI
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "500",
                color: "#0f172a",
                marginBottom: "12px",
              }}
            >
              Ask anything about this company
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: `0.5px solid ${inputFocused ? INDIGO : "#e2e8f0"}`,
                borderRadius: "8px",
                padding: "0 12px",
                height: "42px",
                backgroundColor: "#fff",
                transition: "border-color 0.15s ease",
              }}
            >
              <Icon icon={P.search} size={16} color="#94a3b8" />
              <input
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAsk()}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={`Ask anything about ${companyName || "this company"}…`}
                style={{
                  flex: 1,
                  fontSize: "13px",
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  color: "#0f172a",
                  minWidth: 0,
                }}
              />
              <button
                onClick={() => handleAsk()}
                disabled={isAsking || !question.trim()}
                style={{
                  background: "#4f46e5",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: "500",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: isAsking || !question.trim() ? "not-allowed" : "pointer",
                  opacity: isAsking || !question.trim() ? 0.5 : 1,
                  flexShrink: 0,
                  transition: "opacity 0.15s ease",
                }}
              >
                {isAsking ? "…" : "Ask"}
              </button>
            </div>
          </div>

          {/* Zone 2: suggested questions grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              borderTop: "0.5px solid #e2e8f0",
            }}
          >
            {SUGGESTED.map((sq, i) => {
              const isLastRow  = i >= 4;
              const isRightCol = i % 2 === 1;
              return (
                <button
                  key={sq.q}
                  type="button"
                  onClick={() => {
                    setQuestion(sq.q);
                    handleAsk(sq.q);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "12px 16px",
                    backgroundColor: "#fff",
                    border: "none",
                    borderBottom: isLastRow  ? "none" : "0.5px solid #e2e8f0",
                    borderRight:  isRightCol ? "none" : "0.5px solid #e2e8f0",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.13s ease",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#f8fafc"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fff"; }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      backgroundColor: sq.iconBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "1px",
                    }}
                  >
                    <Icon icon={sq.icon} size={13} color={sq.iconColor} />
                  </div>
                  <span style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
                    {sq.q}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Zone 3: footer strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              backgroundColor: "#f8fafc",
              borderTop: "0.5px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon icon={P.info} size={12} color="#94a3b8" />
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                Answers are grounded in filed accounts and Companies House data
              </span>
            </div>
            <span
              style={{
                fontSize: "11px",
                backgroundColor: INDIGO_BG,
                color: INDIGO_DARK,
                padding: "2px 9px",
                borderRadius: "20px",
                whiteSpace: "nowrap",
                flexShrink: 0,
                marginLeft: "12px",
              }}
            >
              {contextLabel}
            </span>
          </div>

          {/* AI response */}
          {(isAsking || answer) && (
            <div
              style={{
                padding: "14px 16px",
                backgroundColor: "#fff",
                borderTop: "0.5px solid #e2e8f0",
              }}
            >
              {isAsking && (
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  {[0, 150, 300].map(delay => (
                    <div
                      key={delay}
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        backgroundColor: INDIGO,
                        animation: "bounce 1.2s infinite",
                        animationDelay: `${delay}ms`,
                      }}
                    />
                  ))}
                </div>
              )}
              {answer && !isAsking && (
                <div
                  style={{
                    fontSize: "13px",
                    color: "#334155",
                    lineHeight: "1.75",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {answer}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    );
  }

  // ── LEGACY rendering (existing layout, unchanged) ─────────────────────────
  const fh  = analysis.financialHealth;
  const mg  = analysis.margins;
  const cf  = analysis.cashFlowSignals;
  const sd2 = analysis.strategicDirection;
  const rw  = analysis.risksAndWarnings;

  const suggestedQuestions = [
    "What is the financial health of this company?",
    "Who are the current directors and when were they appointed?",
    "What other companies are the directors involved in?",
    "Who are the beneficial owners of this company?",
    "Are there any outstanding charges or red flags?",
    "Summarise the most recent filings",
  ];

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#5B5BD6] rounded-md flex items-center justify-center text-white text-xs font-bold">✦</div>
            <div>
              <div className="text-sm font-semibold leading-tight">AI Document Intelligence</div>
              <div className="text-xs text-gray-400">Extracted from filed accounts</div>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#0F6E56] bg-[#E1F5EE] px-3 py-1 rounded-full">✓ Analysis complete</span>
        </div>

        <div className="bg-[#F5F5FF] border border-[#C7C7F0] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#5B5BD6] text-sm font-bold">✦</span>
            <span className="text-sm font-bold text-[#3D3D9E]">Ask AI about this company</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {suggestedQuestions.map(q => (
              <button
                key={q}
                onClick={() => handleAsk(q)}
                className="text-xs text-[#5B5BD6] bg-white border border-[#C7C7F0] rounded-full px-3 py-1 hover:bg-[#EEEEFF] transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAsk()}
              placeholder={`Ask anything about ${companyName || "this company"}…`}
              className="flex-1 border border-[#C7C7F0] rounded-lg px-3 py-2 text-sm bg-white text-gray-800 outline-none focus:border-[#5B5BD6]"
            />
            <button
              onClick={() => handleAsk()}
              disabled={isAsking || !question.trim()}
              className="bg-[#5B5BD6] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-[#4A4AC5] transition-colors"
            >
              {isAsking ? "…" : "Ask"}
            </button>
          </div>
          {isAsking && (
            <div className="mt-3 flex gap-1">
              {[0, 150, 300].map(d => (
                <div key={d} className="w-2 h-2 bg-[#5B5BD6] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          )}
          {answer && !isAsking && (
            <div className="mt-3 bg-white border border-[#C7C7F0] rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {answer}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Financial health</div>
          {[
            { label: "Revenue",          val: fh?.revenue?.value,          change: fh?.revenue?.yoyChange },
            { label: "Gross profit",     val: fh?.grossProfit?.value,      change: fh?.grossProfit?.yoyChange },
            { label: "Operating profit", val: fh?.operatingProfit?.value,  change: fh?.operatingProfit?.yoyChange },
            { label: "Net profit",       val: fh?.netProfit?.value,        change: fh?.netProfit?.yoyChange },
            { label: "Cash position",    val: fh?.cashPosition,            change: null },
            { label: "Net assets",       val: fh?.netAssets,               change: null },
          ].filter(r => r.val && !isMuted(r.val)).map(({ label, val, change }) => (
            <div key={label} className="flex items-baseline py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-36 shrink-0">{label}</span>
              <span className="text-sm font-semibold mr-2">{val}</span>
              {change && !isMuted(change) && change !== "n/a" && (
                <span className={`text-xs font-semibold ${change.startsWith("-") ? "text-red-500" : "text-[#0F6E56]"}`}>
                  {change.startsWith("-") ? "▼" : "▲"} {change}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Margins & profitability</div>
          {[
            { label: "Gross margin",     val: mg?.grossMargin },
            { label: "Operating margin", val: mg?.operatingMargin },
          ].filter(r => r.val && !isMuted(r.val)).map(({ label, val }) => (
            <div key={label} className="flex items-baseline py-2 border-b border-gray-50 dark:border-gray-800">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-36 shrink-0">{label}</span>
              <span className="text-sm font-semibold">{val}</span>
            </div>
          ))}
          {mg?.trend && !isMuted(mg.trend) && (
            <p className="text-xs text-gray-400 leading-relaxed mt-3">{mg.trend}</p>
          )}
        </div>
      </div>

      {rw?.explicitRisks?.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Key findings</div>
          <div className="space-y-3">
            {rw.explicitRisks.map((finding: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[#1D9E75]" />
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Cash flow</div>
          {cf?.profitToCashConversion && !isMuted(cf.profitToCashConversion) && (
            <div className="flex items-start py-2 border-b border-gray-50 dark:border-gray-800">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-36 shrink-0">Conversion</span>
              <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{cf.profitToCashConversion}</span>
            </div>
          )}
          {cf?.capex && !isMuted(cf.capex) && (
            <div className="flex items-start py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-36 shrink-0">Capex</span>
              <span className="text-sm font-semibold">{cf.capex}</span>
            </div>
          )}
          {cf?.summary && !isMuted(cf.summary) && (
            <p className="text-xs text-gray-400 leading-relaxed mt-2">{cf.summary}</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Strategic direction</div>
          {sd2?.managementOutlook && !isMuted(sd2.managementOutlook) && (
            <div className="flex items-start py-2 border-b border-gray-50 dark:border-gray-800">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-28 shrink-0">Outlook</span>
              <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{sd2.managementOutlook}</span>
            </div>
          )}
          {sd2?.marketsOrGeographies && !isMuted(sd2.marketsOrGeographies) && (
            <div className="flex items-start py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-28 shrink-0">Markets</span>
              <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{sd2.marketsOrGeographies}</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
