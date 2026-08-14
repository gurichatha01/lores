"use client";

import Link from "next/link";
import { useState } from "react";

import { deleteAccount, signIn } from "@/lib/authClient";

import { useAccount } from "./useAccount";

export function AccountClient() {
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function login(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await signIn(email.trim(), password);
    if (!result.ok) setError(result.error ?? "Couldn't log in.");
    else await account.refresh();
    setBusy(false);
  }

  async function remove(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await deleteAccount();
    if (!result.ok) {
      setError(result.error ?? "Couldn't delete your account.");
      setBusy(false);
      return;
    }
    await account.signOut();
    setDeleted(true);
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#dcdcd7] px-6 py-12">
      <section className="w-full max-w-[420px] rounded-[20px] border-2 border-ink bg-surface p-7 shadow-editorial">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-[-1px]">
            lores<span className="text-pink">_</span>
          </Link>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/45">account</span>
        </div>

        {!account.configured ? (
          <p className="mt-6 text-sm font-medium text-ink/60">Accounts aren&apos;t available right now.</p>
        ) : deleted ? (
          <div className="mt-6">
            <h1 className="text-2xl font-black tracking-[-1px]">Account deleted.</h1>
            <p className="mt-2 text-sm font-medium text-ink/60">
              Your email and credit balance have been removed. Your chats and reports were never stored.
            </p>
            <Link
              href="/create"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-sweetheart px-6 font-extrabold text-white"
            >
              make a report →
            </Link>
          </div>
        ) : !account.ready ? (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.1em] text-ink/40">loading…</p>
        ) : account.signedIn ? (
          <div className="mt-6">
            <h1 className="text-[28px] font-black leading-[0.98] tracking-[-1px]">Your pack</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">{account.email}</p>

            <div className="mt-5 border-2 border-ink bg-white p-5 text-center">
              <div className="text-[54px] font-black leading-none tracking-[-2px] text-pink">
                {typeof account.credits === "number" ? account.credits : "…"}
              </div>
              <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink/45">
                of 10 reports left
              </div>
            </div>

            <Link
              href="/create"
              className="mt-5 flex min-h-12 items-center justify-center rounded-[3px] bg-ink px-6 font-extrabold uppercase text-white"
            >
              make a report →
            </Link>

            <button
              type="button"
              onClick={() => void account.signOut()}
              className="mt-3 w-full font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink/45"
            >
              log out
            </button>

            <div className="mt-6 border-t border-hairline pt-4">
              {confirmingDelete ? (
                <div>
                  <p className="text-[12px] font-semibold text-ink/70">
                    Delete your account and remaining credits? This can&apos;t be undone.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void remove()}
                      disabled={busy}
                      className="min-h-10 flex-1 rounded-[3px] bg-roast px-4 text-[12px] font-extrabold uppercase text-white disabled:opacity-60"
                    >
                      {busy ? "deleting…" : "yes, delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={busy}
                      className="min-h-10 flex-1 rounded-[3px] border-2 border-ink px-4 text-[12px] font-extrabold uppercase disabled:opacity-60"
                    >
                      keep it
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-roast/70 underline"
                >
                  delete my account
                </button>
              )}
            </div>
            {error ? <p className="mt-3 text-[12px] font-semibold text-roast">{error}</p> : null}
          </div>
        ) : (
          <div className="mt-6">
            <h1 className="text-[28px] font-black leading-[0.98] tracking-[-1px]">Log in to your pack.</h1>
            <form onSubmit={login} className="mt-5 space-y-3">
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@email.com"
                className="w-full border-2 border-ink bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:shadow-[4px_4px_0_#ccff00]"
              />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="your password"
                className="w-full border-2 border-ink bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:shadow-[4px_4px_0_#ccff00]"
              />
              {error ? <p className="text-[12px] font-semibold text-roast">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="min-h-12 w-full rounded-[3px] bg-ink px-4 text-[14px] font-extrabold uppercase text-white disabled:opacity-60"
              >
                {busy ? "logging in…" : "log in →"}
              </button>
            </form>
            <p className="mt-4 text-center font-mono text-[10px] text-ink/45">
              Accounts come with a 10-report pack.{" "}
              <Link href="/create" className="underline">
                make one →
              </Link>
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
