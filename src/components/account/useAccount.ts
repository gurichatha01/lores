"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import {
  fetchCredits,
  getSession,
  isSupabaseBrowserConfigured,
  onAuthChange,
  signOut as authSignOut,
} from "@/lib/authClient";

export interface Account {
  ready: boolean;
  configured: boolean;
  signedIn: boolean;
  email: string | null;
  /** Server-sourced remaining credits; null while unknown / signed out. */
  credits: number | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** Tracks the Supabase Auth session and the server-authoritative credit count. */
export function useAccount(): Account {
  const configured = isSupabaseBrowserConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [ready, setReady] = useState(!configured);

  const refresh = useCallback(async () => {
    setCredits(await fetchCredits());
  }, []);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    getSession().then((current) => {
      if (!active) return;
      setSession(current);
      setReady(true);
      if (current) void refresh();
    });
    const unsubscribe = onAuthChange((next) => {
      if (!active) return;
      setSession(next);
      if (next) void refresh();
      else setCredits(null);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [configured, refresh]);

  const signOut = useCallback(async () => {
    await authSignOut();
    setCredits(null);
  }, []);

  return {
    ready,
    configured,
    signedIn: Boolean(session),
    email: session?.user?.email ?? null,
    credits,
    refresh,
    signOut,
  };
}
