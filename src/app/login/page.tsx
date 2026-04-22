"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "verify";

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "11px 14px",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "14px",
  color: "#0f172a",
  marginBottom: "12px",
  outline: "none",
  backgroundColor: "#ffffff",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        console.log('[signup] attempting signup for', email);
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        console.log('[signup] response:', JSON.stringify(data), JSON.stringify(err));
        if (err) {
          setError(err.message);
        } else {
          setOtpCode("");
          setMode("verify");
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) {
          setError(err.message);
        } else {
          router.push("/dashboard");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: "email",
    });

    if (err) {
      setError("Invalid or expired code — please try again.");
    } else {
      router.push("/dashboard");
    }

    setLoading(false);
  }

  async function resendCode() {
    setError("");
    const supabase = createClient();
    await supabase.auth.signUp({ email, password });
  }

  function switchMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError("");
    setOtpCode("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }

  function backToSignIn() {
    setMode("signin");
    setError("");
    setOtpCode("");
  }

  const titles: Record<Mode, string> = {
    signin: "Sign in to DeepDue",
    signup: "Create your account",
    verify: "Verify your email",
  };

  const subtitles: Record<Mode, string> = {
    signin: "Welcome back. Enter your details to continue.",
    signup: "Start your free trial — no credit card required.",
    verify: `We sent a 6-digit code to ${email}`,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          boxShadow:
            "0 1px 3px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.08)",
          padding: "40px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontFamily:
              'var(--font-instrument-serif), "Instrument Serif", serif',
            fontSize: "22px",
            lineHeight: "1",
            marginBottom: "32px",
          }}
        >
          <span style={{ color: "#0f172a" }}>Deep</span>
          <span style={{ color: "#4f46e5" }}>Due</span>
          <span style={{ color: "#94a3b8", fontSize: "15px" }}>.ai</span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily:
              'var(--font-instrument-serif), "Instrument Serif", serif',
            fontSize: "26px",
            fontWeight: "400",
            color: "#0f172a",
            marginBottom: "6px",
            lineHeight: "1.2",
          }}
        >
          {titles[mode]}
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#94a3b8",
            marginBottom: "28px",
          }}
        >
          {subtitles[mode]}
        </p>

        {/* ── Verify mode ── */}
        {mode === "verify" ? (
          <form onSubmit={handleVerify}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) =>
                setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
              required
              style={{
                display: "block",
                width: "100%",
                padding: "14px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "24px",
                letterSpacing: "0.3em",
                color: "#0f172a",
                marginBottom: "12px",
                outline: "none",
                backgroundColor: "#ffffff",
                fontFamily: "inherit",
                boxSizing: "border-box",
                textAlign: "center",
              }}
            />

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              style={{
                display: "block",
                width: "100%",
                padding: "11px 16px",
                backgroundColor: "#4f46e5",
                borderRadius: "8px",
                border: "none",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "600",
                cursor: loading || otpCode.length < 6 ? "default" : "pointer",
                fontFamily: "inherit",
                marginBottom: "12px",
                opacity: loading || otpCode.length < 6 ? 0.75 : 1,
              }}
            >
              {loading ? "Verifying…" : "Verify"}
            </button>

            {error && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#dc2626",
                  lineHeight: "1.4",
                  marginBottom: "4px",
                }}
              >
                {error}
              </p>
            )}
          </form>
        ) : (
          <>
            {/* Google OAuth button */}
            <button
              onClick={signInWithGoogle}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                width: "100%",
                padding: "11px 16px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#0f172a",
                fontWeight: "500",
                cursor: "pointer",
                marginBottom: "20px",
                fontFamily: "inherit",
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}
              />
              <span
                style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  whiteSpace: "nowrap",
                }}
              >
                or
              </span>
              <div
                style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}
              />
            </div>

            {/* Email / password form */}
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              {mode === "signup" && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "11px 16px",
                  backgroundColor: "#4f46e5",
                  borderRadius: "8px",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: loading ? "default" : "pointer",
                  fontFamily: "inherit",
                  marginBottom: "12px",
                  opacity: loading ? 0.75 : 1,
                }}
              >
                {loading
                  ? "Please wait…"
                  : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              </button>

              {error && (
                <p
                  style={{
                    fontSize: "13px",
                    color: "#dc2626",
                    lineHeight: "1.4",
                    marginBottom: "4px",
                  }}
                >
                  {error}
                </p>
              )}
            </form>
          </>
        )}

        {/* Bottom links */}
        <p
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: "#94a3b8",
            marginTop: "16px",
          }}
        >
          {mode === "verify" ? (
            <>
              Didn&apos;t receive it?{" "}
              <button
                onClick={resendCode}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "#475569",
                  fontWeight: "500",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
              >
                Resend code
              </button>
              {" · "}
              <button
                onClick={backToSignIn}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "#4f46e5",
                  fontWeight: "600",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              {mode === "signin"
                ? "Don't have an account? "
                : "Already have an account? "}
              <button
                onClick={switchMode}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "#4f46e5",
                  fontWeight: "600",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
