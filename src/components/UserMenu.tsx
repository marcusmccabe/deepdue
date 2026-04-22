"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UserMenu({ email }: { email?: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initial = email ? email[0].toUpperCase() : "?";

  return (
    <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Avatar circle */}
        <div
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            backgroundColor: "rgba(79,70,229,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: "700",
            color: "#4f46e5",
            flexShrink: 0,
          }}
        >
          {initial}
        </div>

        {/* Email + sign-out */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={email}
          >
            {email ?? "Account"}
          </div>
          <button
            onClick={signOut}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: "11px",
              color: "#94a3b8",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
