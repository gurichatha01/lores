"use client";

import { parseReportSession } from "./reportSession";
import type { ReportSessionData } from "./types";

/**
 * Durable, same-browser mirror of the CURRENT report's CONTENT ONLY —
 * mode/subtype/stats/awards/content, exactly the same shape already kept in
 * sessionStorage. This exists purely so a refresh, a closed tab, or a
 * restarted browser doesn't strand a paying customer without their report;
 * sessionStorage alone is cleared when the tab closes.
 *
 * This module stores nothing about whether the report is unlocked, and
 * nothing about login, payment, or credits — that boundary is intentional.
 * Authorization is ALWAYS re-checked against the server
 * (checkReportAuthorization) before anything unlocked is shown or exported;
 * this cache never substitutes for that check and is never consulted by it.
 *
 * The stored value is lightly obfuscated (XOR + base64), not encrypted — the
 * "key" ships in this client bundle, so it provides no real confidentiality.
 * It only avoids sitting as literal human-readable report text in
 * localStorage; it is derived report content, not the raw chat, which never
 * leaves the device in the first place.
 */

const STORAGE_KEY = "lores.report-cache.v1";
const OBFUSCATION_KEY_BYTES = new TextEncoder().encode("lores-report-cache-v1");

function xor(bytes: Uint8Array): Uint8Array {
  const output = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    output[index] = bytes[index] ^ OBFUSCATION_KEY_BYTES[index % OBFUSCATION_KEY_BYTES.length];
  }
  return output;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Mirrors the report content into localStorage, obfuscated. Best-effort. */
export function cacheReportLocally(report: ReportSessionData): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(report);
    const obfuscated = bytesToBase64(xor(new TextEncoder().encode(json)));
    window.localStorage.setItem(STORAGE_KEY, obfuscated);
  } catch {
    /* Storage full/disabled/private mode — sessionStorage still works for this tab. */
  }
}

/** Reads and validates the cached report, or null if absent/corrupt. */
export function readCachedReport(): ReportSessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const obfuscated = window.localStorage.getItem(STORAGE_KEY);
    if (!obfuscated) return null;
    const json = new TextDecoder().decode(xor(base64ToBytes(obfuscated)));
    return parseReportSession(json);
  } catch {
    return null;
  }
}

export function clearCachedReport(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
