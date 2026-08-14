import crypto from "node:crypto";

import type { ReportSessionData } from "./types";

export class EntitlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntitlementError";
  }
}

/** Server-decided pack purchase, remembered between /api/order and /api/verify. */
export interface PackOrderIntent {
  amount: number;
  credits: number;
}

interface EntitlementState {
  generatedReports: Set<string>;
  reports: Map<string, ReportSessionData>;
  orders: Map<string, string>;
  authorizedReports: Set<string>;
  packOrders: Map<string, PackOrderIntent>;
}

const STATE_KEY = "__loresEntitlementState";

function state(): EntitlementState {
  const globalState = globalThis as typeof globalThis & { [STATE_KEY]?: EntitlementState };
  if (!globalState[STATE_KEY]) {
    globalState[STATE_KEY] = {
      generatedReports: new Set<string>(),
      reports: new Map<string, ReportSessionData>(),
      orders: new Map<string, string>(),
      authorizedReports: new Set<string>(),
      packOrders: new Map<string, PackOrderIntent>(),
    };
  }
  return globalState[STATE_KEY];
}

/** Issues an opaque server-known identity only after a report was generated. */
export function issueReportId(): string {
  const reportId = crypto.randomUUID();
  state().generatedReports.add(reportId);
  return reportId;
}

/** Stores the complete generated payload server-side before it can be unlocked. */
export function storeGeneratedReport(reportId: string, report: ReportSessionData): void {
  if (!state().generatedReports.has(reportId)) {
    throw new EntitlementError("This report is not available for storage.");
  }
  state().reports.set(reportId, report);
}

/** Rejects unknown client-supplied report ids before an external order is created. */
export function assertReportAvailable(reportId: string): void {
  if (!state().generatedReports.has(reportId)) {
    throw new EntitlementError("This report is not available for unlock.");
  }
}

/** Binds a server-created Razorpay order to exactly one generated report. */
export function attachOrderToReport(orderId: string, reportId: string): void {
  assertReportAvailable(reportId);
  if (!orderId) throw new EntitlementError("Payment order is missing its identity.");
  state().orders.set(orderId, reportId);
}

/** Remembers a server-created pack order so /api/verify can size the credit grant. */
export function attachPackOrder(orderId: string, intent: PackOrderIntent): void {
  if (!orderId) throw new EntitlementError("Payment order is missing its identity.");
  state().packOrders.set(orderId, intent);
}

/** Reads a pack order intent without consuming it. */
export function getPackOrder(orderId: string): PackOrderIntent | null {
  return state().packOrders.get(orderId) ?? null;
}

/** Removes a pack order once its credits have been durably recorded. */
export function consumePackOrder(orderId: string): void {
  state().packOrders.delete(orderId);
}

/** Called only after the Razorpay HMAC has been validated. */
export function authorizeOrder(orderId: string): string {
  const reportId = state().orders.get(orderId);
  if (!reportId || !state().generatedReports.has(reportId)) {
    throw new EntitlementError("This payment is not attached to a generated report.");
  }
  state().authorizedReports.add(reportId);
  state().orders.delete(orderId);
  return reportId;
}

/**
 * Authorizes a report without a Razorpay order — used when a pack credit is
 * spent for it. Still requires the report to have been genuinely generated.
 */
export function authorizeReport(reportId: string): void {
  if (!state().generatedReports.has(reportId)) {
    throw new EntitlementError("This report is not available for unlock.");
  }
  state().authorizedReports.add(reportId);
}

/** The one authoritative check used by report, PDF, and Wrapped surfaces. */
export function isReportAuthorized(reportId: string): boolean {
  return Boolean(reportId) && state().generatedReports.has(reportId) && state().authorizedReports.has(reportId);
}

/** Returns a full report only after the same per-report entitlement check passes. */
export function getAuthorizedReport(reportId: string): ReportSessionData | null {
  if (!isReportAuthorized(reportId)) return null;
  return state().reports.get(reportId) ?? null;
}

/** Test-only reset so isolated route tests cannot leak entitlement state. */
export function resetEntitlementsForTests(): void {
  if (process.env.NODE_ENV === "test") {
    const current = state();
    current.generatedReports.clear();
    current.reports.clear();
    current.orders.clear();
    current.authorizedReports.clear();
    current.packOrders.clear();
  }
}
