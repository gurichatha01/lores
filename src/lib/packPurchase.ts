"use client";

/**
 * Same-browser stranded-payment recovery. After a verified pack payment we stash
 * the payment id locally so a buyer who closes the tab before finishing signup
 * can return (same browser) and still claim their 10 reports. Different device /
 * cleared storage / incognito has NO automatic recovery by design — that is the
 * manual support backstop (match payment_id in the Razorpay dashboard to the
 * unclaimed Supabase row and bind by hand).
 */

const STASH_KEY = "lores.pack.pending-payment.v1";

export function stashPendingPack(paymentId: string): void {
  if (typeof window === "undefined" || !paymentId) return;
  try {
    window.localStorage.setItem(STASH_KEY, paymentId);
  } catch {
    /* Private mode / storage disabled — recovery just won't be available. */
  }
}

export function readPendingPack(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STASH_KEY);
  } catch {
    return null;
  }
}

export function clearPendingPack(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STASH_KEY);
  } catch {
    /* ignore */
  }
}
