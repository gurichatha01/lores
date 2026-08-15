"use client";

import Link from "next/link";

import { useAccount } from "./useAccount";

/**
 * Reads the actual Supabase Auth session (via useAccount) so the header
 * reflects real sign-in state instead of a hardcoded "log in" link. Both
 * states route to /account: signed out sees the login form, signed in sees
 * their credit balance and account controls.
 */
export function HeaderAccountLink({ className }: { className?: string }) {
  const account = useAccount();

  if (account.signedIn) {
    const label = typeof account.credits === "number" ? `${account.credits} left · account` : "account";
    return (
      <Link href="/account" className={className}>
        {label}
      </Link>
    );
  }

  return (
    <Link href="/account" className={className}>
      log in
    </Link>
  );
}
