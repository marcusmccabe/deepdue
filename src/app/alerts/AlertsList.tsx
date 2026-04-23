"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Alert = {
  id: string;
  company_number: string;
  company_name: string;
  alert_type: string;
  description: string;
  seen: boolean;
  created_at: string;
};

function alertBadgeStyle(alertType: string): { bg: string; color: string; label: string } {
  const t = alertType?.toLowerCase() ?? "";
  if (t.includes("filing")) return { bg: "rgba(79,70,229,0.10)", color: "#4f46e5", label: alertType };
  if (t.includes("director")) return { bg: "rgba(234,179,8,0.12)", color: "#a16207", label: alertType };
  if (t.includes("status")) return { bg: "rgba(220,38,38,0.10)", color: "#dc2626", label: alertType };
  return { bg: "#f1f5f9", color: "#475569", label: alertType };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function AlertItem({ alert, onMarkSeen }: { alert: Alert; onMarkSeen: (a: Alert) => void }) {
  const badge = alertBadgeStyle(alert.alert_type);
  return (
    <div
      onClick={() => onMarkSeen(alert)}
      style={{
        padding: "14px 18px",
        cursor: "pointer",
        backgroundColor: alert.seen ? "transparent" : "rgba(79,70,229,0.02)",
        borderLeft: alert.seen ? "3px solid transparent" : "3px solid #4f46e5",
        transition: "background-color 0.15s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "5px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            fontWeight: "600",
            padding: "2px 7px",
            borderRadius: "100px",
            backgroundColor: badge.bg,
            color: badge.color,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {badge.label}
        </span>
        <span
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#0f172a",
          }}
        >
          {alert.company_name}
        </span>
        {!alert.seen && (
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#4f46e5",
              flexShrink: 0,
              marginLeft: "auto",
            }}
          />
        )}
      </div>
      <div style={{ fontSize: "13px", color: "#475569", marginBottom: "4px" }}>
        {alert.description}
      </div>
      <div style={{ fontSize: "11px", color: "#94a3b8" }}>{formatDate(alert.created_at)}</div>
    </div>
  );
}

export function AlertsList({ initialAlerts }: { initialAlerts: Alert[] }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleAlertClick(alert: Alert) {
    if (!alert.seen) {
      await supabase.from("alerts").update({ seen: true }).eq("id", alert.id);
    }
    router.push(`/company/${alert.company_number}`);
  }

  const unseen = initialAlerts.filter((a) => !a.seen);
  const seen = initialAlerts.filter((a) => a.seen);

  if (initialAlerts.length === 0) {
    return (
      <div style={{ padding: "56px 32px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔔</div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#0f172a",
            marginBottom: "6px",
          }}
        >
          No alerts yet
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "#94a3b8",
            maxWidth: "420px",
            margin: "0 auto",
          }}
        >
          Add companies to your watchlist to receive alerts when they file new accounts or make
          director changes
        </div>
      </div>
    );
  }

  return (
    <div>
      {unseen.length > 0 && (
        <div>
          <div
            style={{
              padding: "10px 18px",
              fontSize: "11px",
              fontWeight: "600",
              color: "#94a3b8",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderBottom: "1px solid #e2e8f0",
              backgroundColor: "#fafbfc",
            }}
          >
            New — {unseen.length} unread
          </div>
          {unseen.map((alert, i) => (
            <div
              key={alert.id}
              style={{ borderBottom: i < unseen.length - 1 || seen.length > 0 ? "1px solid #f1f5f9" : "none" }}
            >
              <AlertItem alert={alert} onMarkSeen={handleAlertClick} />
            </div>
          ))}
        </div>
      )}

      {seen.length > 0 && (
        <div>
          <div
            style={{
              padding: "10px 18px",
              fontSize: "11px",
              fontWeight: "600",
              color: "#94a3b8",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderBottom: "1px solid #e2e8f0",
              backgroundColor: "#fafbfc",
            }}
          >
            Earlier
          </div>
          {seen.map((alert, i) => (
            <div
              key={alert.id}
              style={{ borderBottom: i < seen.length - 1 ? "1px solid #f1f5f9" : "none" }}
            >
              <AlertItem alert={alert} onMarkSeen={handleAlertClick} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
