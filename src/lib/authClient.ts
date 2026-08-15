"use client";

import type { Session } from "@supabase/supabase-js";

import { getSupabaseBrowser, isSupabaseBrowserConfigured } from "./supabaseBrowser";

/**
 * Thin client-side auth surface over Supabase Auth (managed email + password).
 * The session/token lives here; every credit read/write still goes to the server
 * with the access token attached, where the service role is authoritative.
 */

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsConfirmation?: boolean;
}

export { isSupabaseBrowserConfigured };

/**
 * Creates the account server-side (admin, email pre-confirmed) then signs in to
 * obtain a session — so the pack success screen can claim credits immediately
 * without an email round-trip. `code: "exists"` means "log in instead".
 */
export async function signUpAndSignIn(
  email: string,
  password: string,
): Promise<AuthResult & { code?: string }> {
  try {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string; code?: string }
      | null;
    if (!response.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? "We couldn't create your account.", code: body?.code };
    }
  } catch {
    return { ok: false, error: "We couldn't reach the server. Please try again." };
  }
  // Account exists and is confirmed — sign in for a session.
  return signIn(email, password);
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const client = getSupabaseBrowser();
  if (!client) return { ok: false, error: "Accounts aren't available right now." };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const client = getSupabaseBrowser();
  if (!client) return;
  await client.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const client = getSupabaseBrowser();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session ?? null;
}

export async function getAccessToken(): Promise<string | null> {
  return (await getSession())?.access_token ?? null;
}

/** Subscribes to sign-in/out; returns an unsubscribe function. */
export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const client = getSupabaseBrowser();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

/** Server-authoritative credit count for the signed-in user (null if signed out). */
export async function fetchCredits(): Promise<number | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const response = await fetch("/api/account", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { credits?: unknown };
    return typeof body.credits === "number" ? body.credits : null;
  } catch {
    return null;
  }
}

/**
 * Server-verified check for a locally-stashed pending pack payment id. Never
 * trust `readPendingPack()` (localStorage) on its own — it can be stale
 * (already claimed elsewhere, or left over from earlier testing/another
 * account on this browser) or simply wrong. This is unauthenticated: it's
 * called before we know whether the visitor is signed in at all.
 */
export async function checkPendingPack(
  paymentId: string,
): Promise<{ pending: boolean; credits: number } | null> {
  try {
    const response = await fetch("/api/pack-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as
      | { pending?: boolean; credits?: number }
      | null;
    if (!response.ok || typeof body?.pending !== "boolean") return null;
    return { pending: body.pending, credits: body.credits ?? 0 };
  } catch {
    return null;
  }
}

/** Binds a stashed pack payment to the signed-in account. */
export async function claimPack(paymentId: string): Promise<{ ok: boolean; credits?: number; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Please sign in to claim your reports." };
  try {
    const response = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentId }),
    });
    const body = (await response.json().catch(() => null)) as
      | { claimed?: boolean; credits?: number; error?: string }
      | null;
    if (response.ok && body?.claimed) return { ok: true, credits: body.credits };
    return { ok: false, error: body?.error ?? "We couldn't claim that purchase. Please try again." };
  } catch {
    return { ok: false, error: "We couldn't reach your account right now. Please try again." };
  }
}

/** Permanently deletes the signed-in account and its credits. */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Please sign in first." };
  try {
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json().catch(() => null)) as { deleted?: boolean; error?: string } | null;
    if (response.ok && body?.deleted) return { ok: true };
    return { ok: false, error: body?.error ?? "We couldn't delete your account." };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Please try again." };
  }
}

/** Spends one credit to unlock an already-generated report. */
export async function spendCreditForReport(
  reportId: string,
): Promise<{ ok: boolean; creditsRemaining?: number; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Please sign in to use a credit." };
  try {
    const response = await fetch("/api/spend", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reportId }),
    });
    const body = (await response.json().catch(() => null)) as
      | { authorized?: boolean; creditsRemaining?: number; error?: string }
      | null;
    if (response.ok && body?.authorized) return { ok: true, creditsRemaining: body.creditsRemaining };
    return { ok: false, creditsRemaining: body?.creditsRemaining, error: body?.error ?? "We couldn't use a credit." };
  } catch {
    return { ok: false, error: "We couldn't reach your account right now. Please try again." };
  }
}
