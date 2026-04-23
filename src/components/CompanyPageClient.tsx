"use client";

import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import CompanyTabs, { type TabId } from "@/components/CompanyTabs";
import AIAnalysisCard from "@/components/AIAnalysisCard";
import FinancialSnapshotPanel from "@/components/FinancialSnapshotPanel";
import { createClient } from "@/lib/supabase/client";

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

function fmtAccountsType(type?: string): string {
  if (!type) return "—";
  const map: Record<string, string> = {
    "total-exemption-full": "Total Exemption Full",
    "total-exemption-small": "Total Exemption Small",
    "micro-entity": "Micro Entity",
    small: "Small",
    full: "Full",
    group: "Group",
    dormant: "Dormant",
    interim: "Interim",
    initial: "Initial",
    amended: "Amended",
  };
  return map[type] ?? type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtARD(ard: { day?: string | number; month?: string | number }): string {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = parseInt(String(ard.month ?? "0"), 10);
  return m >= 1 && m <= 12 ? `${ard.day} ${MONTHS[m - 1]}` : "—";
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

// ── Director Network Graph ────────────────────────────────────────────────────

function DirectorNetworkGraph({
  company,
  officers,
  networkData,
}: {
  company: any;
  officers: any[];
  networkData: Record<string, any[]>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<{
    x: number; y: number;
    name: string; role?: string; date?: string;
    status?: string; kind: "centre" | "director" | "company";
    companyNum?: string;
  } | null>(null);
  const hideTimeout = useRef<any>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const [infoDir, setInfoDir] = useState<{
    name: string; role: string; appointed: string; otherCount: number;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const HEIGHT = 480;
  const cx = width / 2;
  const cy = HEIGHT / 2;
  const R1 = Math.min(width * 0.22, 135);
  const R2 = Math.min(width * 0.18, 110);

  // ── Pre-compute director data ──────────────────────────────────────────────
  type DirInfo = {
    officer: any; index: number; angle: number; dx: number; dy: number;
    dirName: string; role: string; other: any[];
  };

  const dirCount = officers.length;
  const dirs: DirInfo[] = officers.map((off: any, i: number) => {
    const angle = (2 * Math.PI * i) / Math.max(dirCount, 1) - Math.PI / 2;
    const dirName = off.name ?? `Officer ${i}`;
    const allAppts = networkData[dirName] ?? [];
    const other = allAppts.filter(
      (a: any) => !a.resigned_on && a.appointed_to?.company_number !== company.company_number
    );
    return {
      officer: off, index: i, angle,
      dx: cx + R1 * Math.cos(angle),
      dy: cy + R1 * Math.sin(angle),
      dirName,
      role: (off.officer_role ?? "officer").replace(/-/g, " "),
      other,
    };
  });

  // ── Build nodes and edges ──────────────────────────────────────────────────
  type GNode = {
    id: string; x: number; y: number; r: number;
    label: string; fill: string; stroke?: string; strokeDash?: string;
    kind: "centre" | "director" | "company";
    dirName?: string; companyNum?: string; role?: string; date?: string;
    totalOther?: number; expandable?: boolean; isExpanded?: boolean;
    companyStatus?: string;
  };
  type GEdge = {
    x1: number; y1: number; x2: number; y2: number;
    r1: number; r2: number; dirName?: string; isSecondRing?: boolean;
  };

  const nodes: GNode[] = [];
  const edges: GEdge[] = [];

  // Centre node
  nodes.push({
    id: "c", x: cx, y: cy, r: 28,
    label: company.company_name ?? "Company",
    fill: "#4f46e5", kind: "centre",
  });

  // Director + company nodes
  dirs.forEach((d) => {
    const isExp = expanded.has(d.dirName);
    const expandable = d.other.length > 0;

    nodes.push({
      id: `d${d.index}`, x: d.dx, y: d.dy, r: 20,
      label: d.dirName,
      fill: expandable ? "#334155" : "#64748b",
      kind: "director", dirName: d.dirName,
      role: d.role, totalOther: d.other.length,
      expandable, isExpanded: isExp,
      date: d.officer.appointed_on,
    });
    edges.push({ x1: cx, y1: cy, x2: d.dx, y2: d.dy, r1: 28, r2: 20, dirName: d.dirName });

    // Second-ring company nodes — only when expanded
    if (isExp && d.other.length > 0) {
      // Sort: active companies first, dissolved last
      const sorted = [...d.other].sort((a: any, b: any) => {
        const aD = a.appointed_to?.company_status === "dissolved" ? 1 : 0;
        const bD = b.appointed_to?.company_status === "dissolved" ? 1 : 0;
        return aD - bD;
      });
      const shown = sorted.slice(0, 6);
      const count = shown.length;

      // Dynamic fan spread: wider for more nodes
      const fanSpread = count >= 6 ? (110 * Math.PI / 180)
        : count >= 4 ? (90 * Math.PI / 180)
        : Math.max((count - 1) * 0.45, 0.15);

      shown.forEach((appt: any, ci: number) => {
        const startA = d.angle - fanSpread / 2;
        const step = count > 1 ? fanSpread / (count - 1) : 0;
        const cAngle = count === 1 ? d.angle : startA + step * ci;
        const compX = d.dx + R2 * Math.cos(cAngle);
        const compY = d.dy + R2 * Math.sin(cAngle);
        const dissolved = appt.appointed_to?.company_status === "dissolved";
        const status = appt.appointed_to?.company_status ?? "unknown";

        nodes.push({
          id: `co${d.index}-${ci}`, x: compX, y: compY, r: 12,
          label: appt.appointed_to?.company_name ?? "Unknown",
          fill: dissolved ? "#f8fafc" : "#e2e8f0",
          stroke: dissolved ? "#cbd5e1" : "#94a3b8",
          strokeDash: dissolved ? "3,2" : undefined,
          kind: "company", dirName: d.dirName,
          companyNum: appt.appointed_to?.company_number,
          date: appt.appointed_on, companyStatus: status,
        });
        edges.push({
          x1: d.dx, y1: d.dy, x2: compX, y2: compY,
          r1: 20, r2: 12, dirName: d.dirName, isSecondRing: true,
        });
      });
    }
  });

  const trunc = (s: string, max: number) =>
    s.length > max ? s.slice(0, max - 1) + "\u2026" : s;

  function clipEdge(e: GEdge) {
    const ddx = e.x2 - e.x1;
    const ddy = e.y2 - e.y1;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dist < 1) return { ax: e.x1, ay: e.y1, bx: e.x2, by: e.y2 };
    const nx = ddx / dist;
    const ny = ddy / dist;
    return {
      ax: e.x1 + nx * e.r1, ay: e.y1 + ny * e.r1,
      bx: e.x2 - nx * e.r2, by: e.y2 - ny * e.r2,
    };
  }

  function toggleExpand(dirName: string) {
    const wasExpanded = expanded.has(dirName);

    setExpanded((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(dirName)) {
        next.delete(dirName);
        setInfoDir(null);
      } else {
        next.add(dirName);
        const d = dirs.find((dd) => dd.dirName === dirName);
        if (d) {
          setInfoDir({
            name: d.dirName, role: d.role,
            appointed: fmtDate(d.officer.appointed_on),
            otherCount: d.other.length,
          });
        }
      }
      return next;
    });

    // Auto-pan when expanding if company nodes would be clipped
    if (!wasExpanded) {
      const d = dirs.find((dd) => dd.dirName === dirName);
      if (d && d.other.length > 0) {
        const sorted = [...d.other].sort((a: any, b: any) => {
          const aD = a.appointed_to?.company_status === "dissolved" ? 1 : 0;
          const bD = b.appointed_to?.company_status === "dissolved" ? 1 : 0;
          return aD - bD;
        });
        const count = Math.min(sorted.length, 6);
        const fanSpread = count >= 6 ? (110 * Math.PI / 180)
          : count >= 4 ? (90 * Math.PI / 180)
          : Math.max((count - 1) * 0.45, 0.15);

        let sumY = 0;
        for (let ci = 0; ci < count; ci++) {
          const startA = d.angle - fanSpread / 2;
          const step = count > 1 ? fanSpread / (count - 1) : 0;
          const cAngle = count === 1 ? d.angle : startA + step * ci;
          sumY += d.dy + R2 * Math.sin(cAngle);
        }
        const avgY = sumY / count;

        if (avgY + pan.y < 60) {
          setPan((p: { x: number; y: number }) => ({ ...p, y: 40 - avgY }));
        } else if (avgY + pan.y > HEIGHT - 60) {
          setPan((p: { x: number; y: number }) => ({ ...p, y: HEIGHT - 40 - avgY }));
        }
      }
    }
  }

  function showTooltip(n: GNode) {
    if (hideTimeout.current) { clearTimeout(hideTimeout.current); hideTimeout.current = null; }
    setHoveredNode({
      x: n.x, y: n.y, name: n.label, role: n.role,
      date: n.date ? fmtDate(n.date) : undefined,
      status: n.companyStatus,
      kind: n.kind as "centre" | "director" | "company",
      companyNum: n.companyNum,
    });
  }

  function scheduleHide() {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      setHoveredNode(null);
      hideTimeout.current = null;
    }, 150);
  }

  function cancelHide() {
    if (hideTimeout.current) { clearTimeout(hideTimeout.current); hideTimeout.current = null; }
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{ position: "relative", width: "100%", height: HEIGHT, overflow: "hidden" }}
      >
        <svg
          width={width} height={HEIGHT}
          style={{ display: "block", cursor: dragging ? "grabbing" : "grab" }}
          onMouseDown={(e: any) => {
            isPanning.current = true;
            didDrag.current = false;
            panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            setHoveredNode(null);
            if (hideTimeout.current) { clearTimeout(hideTimeout.current); hideTimeout.current = null; }
          }}
          onMouseMove={(e: any) => {
            if (!isPanning.current) return;
            const nx = e.clientX - panStart.current.x;
            const ny = e.clientY - panStart.current.y;
            if (!didDrag.current) {
              if (Math.abs(nx - pan.x) + Math.abs(ny - pan.y) < 3) return;
              didDrag.current = true;
              setDragging(true);
            }
            setPan({ x: nx, y: ny });
          }}
          onMouseUp={() => {
            isPanning.current = false;
            if (didDrag.current) setDragging(false);
          }}
          onMouseLeave={() => {
            isPanning.current = false;
            if (didDrag.current) setDragging(false);
          }}
        >
          <g transform={`translate(${pan.x},${pan.y})`}>
            {/* Edges */}
            {edges.map((e, i) => {
              const { ax, ay, bx, by } = clipEdge(e);
              return (
                <line
                  key={`e${i}`} x1={ax} y1={ay} x2={bx} y2={by}
                  stroke={e.isSecondRing ? "#cbd5e1" : "#e2e8f0"} strokeWidth={1.5}
                  style={{ transition: "opacity 0.2s" }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((n) => (
              <g
                key={n.id}
                style={{
                  cursor: n.kind === "centre" ? "default"
                    : n.kind === "director" && !n.expandable ? "default"
                    : "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={() => {
                  if (!isPanning.current && (n.kind === "company" || n.kind === "director")) showTooltip(n);
                }}
                onMouseLeave={() => scheduleHide()}
                onClick={(ev: any) => {
                  ev.stopPropagation();
                  if (didDrag.current) return;
                  if (n.kind === "company" && n.companyNum) {
                    window.location.href = `/company/${n.companyNum}`;
                  } else if (n.kind === "director" && n.expandable) {
                    toggleExpand(n.dirName!);
                  }
                }}
              >
                {/* Node circle */}
                <circle
                  cx={n.x} cy={n.y} r={n.r} fill={n.fill}
                  stroke={n.stroke ?? "none"} strokeWidth={n.stroke ? 1.5 : 0}
                  strokeDasharray={n.strokeDash ?? "none"}
                />

                {/* Director: +/− indicator inside circle */}
                {n.kind === "director" && n.expandable && (
                  <text
                    x={n.x} y={n.y + 5}
                    textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff"
                    style={{ pointerEvents: "none" }}
                  >
                    {n.isExpanded ? "\u2212" : "+"}
                  </text>
                )}

                {/* Director: amber count badge (top-right) */}
                {n.kind === "director" && (n.totalOther ?? 0) > 0 && (
                  <>
                    <circle cx={n.x + 15} cy={n.y - 15} r={9} fill="#d97706" />
                    <text
                      x={n.x + 15} y={n.y - 11.5}
                      textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff"
                      style={{ pointerEvents: "none" }}
                    >
                      {n.totalOther}
                    </text>
                  </>
                )}

                {/* Company node: status dot */}
                {n.kind === "company" && (
                  <circle
                    cx={n.x + 9} cy={n.y - 9} r={3.5}
                    fill={n.companyStatus === "dissolved" ? "#dc2626" : "#059669"}
                  />
                )}

                {/* Centre label */}
                {n.kind === "centre" && (
                  <text
                    x={n.x} y={n.y + n.r + 16}
                    textAnchor="middle" fontSize="11" fontWeight="700" fill="#4f46e5"
                    style={{ pointerEvents: "none" }}
                  >
                    {trunc(n.label, 28)}
                  </text>
                )}

                {/* Director label */}
                {n.kind === "director" && (
                  <text
                    x={n.x} y={n.y > cy + 50 ? n.y - n.r - 6 : n.y + n.r + 13}
                    textAnchor="middle" fontSize="9" fontWeight="600"
                    fill={n.expandable ? "#334155" : "#94a3b8"}
                    style={{ pointerEvents: "none" }}
                  >
                    {trunc(n.label, 20)}
                  </text>
                )}

                {/* Company label (truncated name) */}
                {n.kind === "company" && (
                  <text
                    x={n.x} y={n.y + n.r + 11}
                    textAnchor="middle" fontSize="8" fontWeight="500" fill="#64748b"
                    style={{ pointerEvents: "none" }}
                  >
                    {trunc(n.label, 18)}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>

        {/* Reset view button */}
        {(pan.x !== 0 || pan.y !== 0) && (
          <button
            onClick={() => setPan({ x: 0, y: 0 })}
            style={{
              position: "absolute", bottom: "10px", right: "10px",
              padding: "4px 10px", borderRadius: "6px",
              border: "1px solid #e2e8f0", backgroundColor: "#fff",
              fontSize: "11px", fontWeight: "500", color: "#64748b",
              cursor: "pointer", zIndex: 10,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            Reset view
          </button>
        )}

        {/* Info panel — top-left */}
        {infoDir && (
          <div
            style={{
              position: "absolute", top: "10px", left: "10px",
              backgroundColor: "#fff", border: "1px solid #e2e8f0",
              borderRadius: "8px", padding: "10px 14px",
              fontSize: "11px", lineHeight: "1.6",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              maxWidth: "220px", zIndex: 10,
            }}
          >
            <div style={{ fontWeight: "700", fontSize: "12px", color: "#0f172a", marginBottom: "2px" }}>
              {infoDir.name}
            </div>
            <div style={{ color: "#64748b", textTransform: "capitalize" }}>{infoDir.role}</div>
            <div style={{ color: "#64748b" }}>Appointed: {infoDir.appointed}</div>
            <div style={{ color: "#334155", fontWeight: "600", marginTop: "4px" }}>
              {infoDir.otherCount} other directorship{infoDir.otherCount !== 1 ? "s" : ""}
            </div>
            <button
              onClick={() => setInfoDir(null)}
              style={{
                position: "absolute", top: "6px", right: "8px",
                background: "none", border: "none", cursor: "pointer",
                fontSize: "14px", color: "#94a3b8", lineHeight: "1",
              }}
            >
              x
            </button>
          </div>
        )}

        {/* Tooltip — persists when hovering onto it */}
        {hoveredNode && (
          <div
            onMouseEnter={cancelHide}
            onMouseLeave={() => setHoveredNode(null)}
            style={{
              position: "absolute",
              left: Math.min(hoveredNode.x + pan.x + 18, width - 230),
              top: Math.max(hoveredNode.y + pan.y - 50, 4),
              backgroundColor: "#0f172a", color: "#fff",
              padding: "10px 14px", borderRadius: "8px",
              fontSize: "11px", lineHeight: "1.6",
              zIndex: 20, maxWidth: "220px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontWeight: "600", fontSize: "12px", marginBottom: "3px" }}>
              {hoveredNode.name}
            </div>
            {hoveredNode.role && (
              <div style={{ color: "#94a3b8", textTransform: "capitalize" }}>{hoveredNode.role}</div>
            )}
            {hoveredNode.date && (
              <div style={{ color: "#94a3b8" }}>Appointed: {hoveredNode.date}</div>
            )}
            {hoveredNode.status && (
              <div style={{
                color: hoveredNode.status === "dissolved" ? "#fca5a5" : "#6ee7b7",
                textTransform: "capitalize",
              }}>
                {hoveredNode.status}
              </div>
            )}
            {hoveredNode.kind === "company" && hoveredNode.companyNum && (
              <a
                href={`/company/${hoveredNode.companyNum}`}
                style={{
                  display: "inline-block", marginTop: "6px",
                  color: "#818cf8", fontWeight: "600", fontSize: "11px",
                  textDecoration: "none",
                }}
              >
                View company &rarr;
              </a>
            )}
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", padding: "6px 0 2px", fontSize: "11px", color: "#94a3b8" }}>
        Drag to explore
      </div>
    </>
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

  // ── Watchlist state ─────────────────────────────────────────────────────────
  type WatchlistState = "checking" | "idle" | "saving" | "done" | "error";
  const [watchlistState, setWatchlistState] = useState<WatchlistState>("checking");
  const [watchlistErrorMsg, setWatchlistErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function checkWatchlist() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setWatchlistState("idle"); return; }
      const { data } = await supabase
        .from("watchlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_number", company.company_number)
        .maybeSingle();
      setWatchlistState(data ? "done" : "idle");
    }
    checkWatchlist();
  }, [company.company_number]);

  async function handleWatchlist() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    console.log("[watchlist] user:", user?.id ?? "null — not logged in");
    if (!user) { window.location.href = "/login"; return; }
    setWatchlistState("saving");
    setWatchlistErrorMsg(null);
    const insertData = {
      user_id: user.id,
      company_number: company.company_number,
      company_name: company.company_name,
      company_status: company.company_status,
      last_accounts_date: company.accounts?.last_accounts?.made_up_to ?? null,
      next_accounts_due: company.accounts?.next_accounts?.due_on ?? company.accounts?.next_due ?? null,
    };
    console.log("[watchlist] inserting:", insertData);
    const { error } = await supabase.from("watchlist").insert(insertData);
    console.log("[watchlist] insert error:", error ?? "none");
    if (error) {
      setWatchlistErrorMsg(`${error.message} (code: ${error.code})`);
      setWatchlistState("error");
      setTimeout(() => setWatchlistState("idle"), 5000);
    } else {
      setWatchlistState("done");
    }
  }

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

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={watchlistState === "idle" ? handleWatchlist : undefined}
            disabled={watchlistState !== "idle"}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: watchlistState === "error"
                ? "1px solid rgba(220,38,38,0.4)"
                : watchlistState === "done"
                ? "1px solid rgba(5,150,105,0.3)"
                : "1px solid #e2e8f0",
              backgroundColor: watchlistState === "done"
                ? "rgba(5,150,105,0.08)"
                : watchlistState === "error"
                ? "rgba(220,38,38,0.08)"
                : "#ffffff",
              color: watchlistState === "done"
                ? "#059669"
                : watchlistState === "error"
                ? "#dc2626"
                : "#475569",
              fontSize: "13px",
              fontWeight: watchlistState === "done" ? "600" : "500",
              cursor: watchlistState === "idle" ? "pointer" : "default",
              opacity: watchlistState === "checking" || watchlistState === "saving" ? 0.55 : 1,
              transition: "all 0.15s",
            }}
          >
            {watchlistState === "checking" || watchlistState === "saving"
              ? "…"
              : watchlistState === "done"
              ? "✓ Watchlisted"
              : watchlistState === "error"
              ? "Error — retry"
              : "+ Watchlist"}
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
          {watchlistErrorMsg && (
            <div style={{
              fontSize: "12px",
              color: "#dc2626",
              backgroundColor: "rgba(220,38,38,0.06)",
              border: "1px solid rgba(220,38,38,0.25)",
              borderRadius: "6px",
              padding: "6px 10px",
              maxWidth: "340px",
              wordBreak: "break-word",
            }}>
              Watchlist error: {watchlistErrorMsg}
            </div>
          )}
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

              {/* Charges Summary */}
              {charges.length > 0 && (
                <div style={CARD}>
                  <div style={CARD_HEADER}>
                    <span style={CARD_TITLE}>Charges</span>
                    <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                      {charges.length} {charges.length === 1 ? "charge" : "charges"}
                    </span>
                  </div>
                  <div>
                    {charges.slice(0, 5).map((charge: any, i: number) => {
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
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            padding: "13px 18px",
                            borderBottom: i < Math.min(charges.length, 5) - 1 ? "1px solid #f1f5f9" : "none",
                            borderLeft: isOutstanding ? "3px solid #dc2626" : "3px solid transparent",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "3px" }}>
                              {lenderName}
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569" }}>
                              {charge.classification?.description ?? "Registered charge"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                            <span style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "100px",
                              fontSize: "11px",
                              fontWeight: "600",
                              color: statusColor,
                              backgroundColor: statusBg,
                              border: `1px solid ${statusBorder}`,
                              textTransform: "capitalize",
                            }}>
                              {(charge.status ?? "unknown").replace(/-/g, " ")}
                            </span>
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                              {fmtDate(charge.created_on)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {charges.length > 5 && (
                      <div style={{ padding: "10px 18px", fontSize: "11px", color: "#94a3b8", borderTop: "1px solid #f1f5f9" }}>
                        +{charges.length - 5} more — see Charges tab
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PSC Summary */}
              {pscs.length > 0 && (
                <div style={CARD}>
                  <div style={CARD_HEADER}>
                    <span style={CARD_TITLE}>Persons with Significant Control</span>
                    <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                      {pscs.length} PSC{pscs.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div>
                    {pscs.map((psc: any, i: number) => {
                      const isCorporate = psc.kind?.includes("corporate") || psc.kind?.includes("legal-person");
                      const ukJurisdictions = ["england","wales","scotland","northern ireland","united kingdom","great britain","england and wales"];
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
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            padding: "13px 18px",
                            borderBottom: i < pscs.length - 1 ? "1px solid #f1f5f9" : "none",
                            borderLeft: isOffshore ? "3px solid #d97706" : isCorporate ? "3px solid #4f46e5" : "3px solid transparent",
                          }}
                        >
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
                            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                              <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ownership</div>
                              <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>{ownershipBand}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  <div style={{ height: "480px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
                      <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "#f1f5f9" }} />
                      <div style={{ display: "flex", gap: "40px" }}>
                        {[0, 1, 2].map((k) => (
                          <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#f1f5f9" }} />
                            <div style={{ width: "50px", height: "8px", borderRadius: "4px", backgroundColor: "#f8fafc" }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : officers.length === 0 ? (
                  <div style={{ padding: "28px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                    No officers found
                  </div>
                ) : (
                  <DirectorNetworkGraph company={company} officers={officers} networkData={networkData} />
                )}
              </div>

              {/* AI analysis — Risks & Warnings now lives inside this card */}
              <AIAnalysisCard companyNumber={company.company_number} />
            </>
          )}

          {/* Financials tab */}
          {activeTab === "financials" && (
            <FinancialSnapshotPanel companyNumber={company.company_number} />
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

          {/* Accounts card */}
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span style={CARD_TITLE}>Accounts</span>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {company.accounts?.last_accounts?.made_up_to ? (
                <>
                  <div>
                    <div style={LABEL}>Last Accounts</div>
                    <div style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a" }}>
                      {fmtDate(company.accounts.last_accounts.made_up_to)}
                    </div>
                    {company.accounts.last_accounts.type && (
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                        {fmtAccountsType(company.accounts.last_accounts.type)}
                      </div>
                    )}
                  </div>

                  {(company.accounts.next_accounts?.due_on ?? company.accounts.next_due) && (
                    <>
                      <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />
                      <div>
                        <div style={LABEL}>Next Due</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <div style={{ fontSize: "13px", fontWeight: "500", color: company.accounts.next_accounts?.overdue ? "#dc2626" : "#0f172a" }}>
                            {fmtDate(company.accounts.next_accounts?.due_on ?? company.accounts.next_due)}
                          </div>
                          {company.accounts.next_accounts?.overdue && (
                            <span style={{
                              fontSize: "10px",
                              fontWeight: "600",
                              color: "#dc2626",
                              backgroundColor: "rgba(220,38,38,0.10)",
                              border: "1px solid rgba(220,38,38,0.25)",
                              padding: "1px 7px",
                              borderRadius: "100px",
                            }}>
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {company.accounts.accounting_reference_date && (
                    <>
                      <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />
                      <div>
                        <div style={LABEL}>Year End</div>
                        <div style={{ fontSize: "13px", color: "#0f172a" }}>
                          {fmtARD(company.accounts.accounting_reference_date)}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ fontSize: "13px", color: "#94a3b8" }}>No accounts on record</div>
              )}
            </div>
          </div>

          {/* Charges & PSC card */}
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span style={CARD_TITLE}>Charges &amp; PSC</span>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <div style={LABEL}>Charges</div>
                {charges.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "#94a3b8" }}>None registered</div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
                      {charges.length} total
                    </span>
                    {(() => {
                      const outstanding = charges.filter((c: any) => c.status === "outstanding");
                      if (outstanding.length > 0) {
                        return (
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: "#dc2626",
                            backgroundColor: "rgba(220,38,38,0.10)",
                            border: "1px solid rgba(220,38,38,0.25)",
                            padding: "2px 8px",
                            borderRadius: "100px",
                          }}>
                            {outstanding.length} outstanding
                          </span>
                        );
                      }
                      return (
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "600",
                          color: "#059669",
                          backgroundColor: "rgba(5,150,105,0.10)",
                          border: "1px solid rgba(5,150,105,0.25)",
                          padding: "2px 8px",
                          borderRadius: "100px",
                        }}>
                          All satisfied
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />

              <div>
                <div style={LABEL}>Persons with Significant Control</div>
                {pscs.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "#94a3b8" }}>None recorded</div>
                ) : (
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "8px" }}>
                      {pscs.length} active PSC{pscs.length !== 1 ? "s" : ""}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {pscs.slice(0, 3).map((psc: any, i: number) => {
                        const isCorporate = psc.kind?.includes("corporate") || psc.kind?.includes("legal-person");
                        const ukJurisdictions = ["england","wales","scotland","northern ireland","united kingdom","great britain","england and wales"];
                        const residenceCountry = (psc.country_of_residence ?? psc.identification?.country_registered ?? psc.address?.country ?? "").toLowerCase().trim();
                        const isOffshore = !!residenceCountry && !ukJurisdictions.some((j: string) => residenceCountry.includes(j));
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: "500" }}>
                              {psc.name ?? "Unknown"}
                            </span>
                            {isCorporate && (
                              <span style={{ fontSize: "9px", fontWeight: "600", color: "#4f46e5", backgroundColor: "rgba(79,70,229,0.08)", padding: "1px 5px", borderRadius: "4px" }}>
                                Corp
                              </span>
                            )}
                            {isOffshore && (
                              <span style={{ fontSize: "9px", fontWeight: "600", color: "#d97706", backgroundColor: "rgba(217,119,6,0.10)", padding: "1px 5px", borderRadius: "4px" }}>
                                Offshore
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {pscs.length > 3 && (
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>+{pscs.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
