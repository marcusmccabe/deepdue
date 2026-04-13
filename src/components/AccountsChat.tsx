"use client";

console.error("AccountsChat module evaluated");

export default function AccountsChat(_props: {
  companyNumber: string;
  companyName: string;
}) {
  console.error("AccountsChat rendering");

  try {
    return (
      <div
        style={{
          backgroundColor: "#dc2626",
          color: "#ffffff",
          padding: "16px 18px",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "700",
        }}
      >
        CHAT COMPONENT LOADED
      </div>
    );
  } catch (err) {
    return (
      <div
        style={{
          backgroundColor: "#dc2626",
          color: "#ffffff",
          padding: "16px 18px",
          borderRadius: "8px",
          fontSize: "12px",
        }}
      >
        CHAT ERROR: {String(err)}
      </div>
    );
  }
}
