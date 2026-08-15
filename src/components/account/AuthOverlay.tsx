"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { signIn, signUpAndSignIn } from "@/lib/authClient";

export type AuthMode = "signup" | "login";

interface AuthOverlayProps {
  mode: AuthMode;
  accent: string;
  /** Shown above the form in signup mode (e.g. "You've got 10 reports."). */
  headline?: string;
  subhead?: string;
  busyLabel?: string;
  onClose: () => void;
  onAuthed: () => void | Promise<void>;
}

const PACK_PRIVACY =
  "A 10-report pack creates an account so you can come back for your reports. We store your email and how many reports you have left — never your chats, never your reports. Single reports need no account.";

export function AuthOverlay({
  mode: initialMode,
  accent,
  headline,
  subhead,
  busyLabel,
  onClose,
  onAuthed,
}: AuthOverlayProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result: { ok: boolean; error?: string; code?: string } =
      mode === "signup"
        ? await signUpAndSignIn(email.trim(), password)
        : await signIn(email.trim(), password);
    if (!result.ok) {
      if (mode === "signup" && result.code === "exists") {
        setMode("login");
        setError("That email already has an account — log in and your reports will attach to it.");
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
      setBusy(false);
      return;
    }
    await onAuthed();
    // Parent unmounts on success; keep busy true so the button stays disabled.
  }

  const isSignup = mode === "signup";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 px-4 pb-4 pt-10 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isSignup ? "Create your account" : "Log in"}
    >
      <div className="w-full max-w-[400px] overflow-hidden rounded-[20px] border-2 border-ink bg-surface shadow-editorial">
        <div className="px-6 pb-6 pt-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>
              {isSignup ? "unlock your pack" : "welcome back"}
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-ink/45 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden="true" strokeWidth={2.5} />
            </button>
          </div>

          <h2 className="mt-3 text-[26px] font-black leading-[0.98] tracking-[-1px]">
            {headline ?? (isSignup ? "Create your account." : "Log in to your pack.")}
          </h2>
          {subhead ? (
            <p className="mt-2 text-[13px] font-medium leading-relaxed text-ink/60">{subhead}</p>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink/45">email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full border-2 border-ink bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:shadow-[4px_4px_0_#ccff00]"
                placeholder="you@email.com"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink/45">password</span>
              <input
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full border-2 border-ink bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:shadow-[4px_4px_0_#ccff00]"
                placeholder={isSignup ? "at least 8 characters" : "your password"}
              />
            </label>

            {error ? (
              <p role="alert" className="border-2 border-roast bg-white px-3 py-2 text-[12px] font-semibold text-roast">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="min-h-[50px] w-full rounded-[3px] px-4 text-[14px] font-extrabold uppercase text-white disabled:opacity-60"
              style={{ background: accent }}
            >
              {busy
                ? busyLabel ?? "working…"
                : isSignup
                  ? "create account & unlock →"
                  : "log in →"}
            </button>
          </form>

          {isSignup ? (
            <p className="mt-4 border-t border-hairline pt-3 text-[11px] font-medium leading-relaxed text-ink/55">
              {PACK_PRIVACY}
            </p>
          ) : (
            <p className="mt-4 text-center font-mono text-[10px] text-ink/45">
              Accounts come with a 10-report pack. Buy one to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
