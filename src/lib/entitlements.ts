import crypto from "node:crypto";

import { getServiceClient, isSupabaseConfigured, SupabaseRequestError } from "./supabaseServer";

/**
 * Per-report entitlement store. Durable, serverless-safe: when Supabase is
 * configured, all state lives in the `reports` / `report_orders` tables so every
 * instance sees the same thing (a report generated on one Vercel instance is
 * visible to the order/verify/spend call on another). When Supabase is NOT
 * configured (local single-instance dev, and tests) it falls back to an
 * in-memory store with identical semantics.
 *
 * By design this holds only a REFERENCE — the report id, order→report bindings,
 * and the authorized flag. The report CONTENT never touches the server store;
 * the browser keeps it, so "never your chats, never your reports" stays true.
 */

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

interface OrderRecord {
  productType: "single" | "pack10";
  reportId?: string;
  amount?: number;
  credits?: number;
}

// ---- in-memory fallback (only when Supabase is unconfigured) ----
interface MemoryState {
  reports: Map<string, boolean>; // reportId -> authorized
  orders: Map<string, OrderRecord>; // orderId -> intent
}

const MEMORY_KEY = "__loresEntitlementMemory";

function memory(): MemoryState {
  const store = globalThis as typeof globalThis & { [MEMORY_KEY]?: MemoryState };
  if (!store[MEMORY_KEY]) {
    store[MEMORY_KEY] = { reports: new Map(), orders: new Map() };
  }
  return store[MEMORY_KEY];
}

/** Issues an opaque report identity. The row is created by registerReport. */
export function issueReportId(): string {
  return crypto.randomUUID();
}

/** Records that a report was generated (unauthorized). Idempotent. */
export async function registerReport(reportId: string): Promise<void> {
  if (!reportId) throw new EntitlementError("Report is missing its identity.");
  if (!isSupabaseConfigured()) {
    if (!memory().reports.has(reportId)) memory().reports.set(reportId, false);
    return;
  }
  const { error } = await getServiceClient()
    .from("reports")
    .upsert({ id: reportId, authorized: false }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new SupabaseRequestError(error.message);
}

/** Rejects unknown report ids before an external order is created. */
export async function assertReportAvailable(reportId: string): Promise<void> {
  if (!reportId) throw new EntitlementError("This report is not available for unlock.");
  if (!isSupabaseConfigured()) {
    if (!memory().reports.has(reportId)) {
      throw new EntitlementError("This report is not available for unlock.");
    }
    return;
  }
  const { data, error } = await getServiceClient()
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new SupabaseRequestError(error.message);
  if (!data) throw new EntitlementError("This report is not available for unlock.");
}

/** Binds a server-created Razorpay order to exactly one generated report. */
export async function attachOrderToReport(orderId: string, reportId: string): Promise<void> {
  await assertReportAvailable(reportId);
  if (!orderId) throw new EntitlementError("Payment order is missing its identity.");
  if (!isSupabaseConfigured()) {
    memory().orders.set(orderId, { productType: "single", reportId });
    return;
  }
  const { error } = await getServiceClient()
    .from("report_orders")
    .upsert({ order_id: orderId, product_type: "single", report_id: reportId }, { onConflict: "order_id" });
  if (error) throw new SupabaseRequestError(error.message);
}

/** Remembers a server-created pack order so /api/verify can size the credit grant. */
export async function attachPackOrder(orderId: string, intent: PackOrderIntent): Promise<void> {
  if (!orderId) throw new EntitlementError("Payment order is missing its identity.");
  if (!isSupabaseConfigured()) {
    memory().orders.set(orderId, { productType: "pack10", amount: intent.amount, credits: intent.credits });
    return;
  }
  const { error } = await getServiceClient()
    .from("report_orders")
    .upsert(
      { order_id: orderId, product_type: "pack10", amount: intent.amount, credits: intent.credits },
      { onConflict: "order_id" },
    );
  if (error) throw new SupabaseRequestError(error.message);
}

/** Reads a pack order intent (idempotent; unique payment_id guards double writes). */
export async function getPackOrder(orderId: string): Promise<PackOrderIntent | null> {
  if (!isSupabaseConfigured()) {
    const record = memory().orders.get(orderId);
    return record?.productType === "pack10"
      ? { amount: record.amount ?? 0, credits: record.credits ?? 0 }
      : null;
  }
  const { data, error } = await getServiceClient()
    .from("report_orders")
    .select("product_type, amount, credits")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new SupabaseRequestError(error.message);
  if (!data || data.product_type !== "pack10") return null;
  return { amount: data.amount ?? 0, credits: data.credits ?? 0 };
}

/** Called only after the Razorpay HMAC has been validated (single purchase). */
export async function authorizeOrder(orderId: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    const record = memory().orders.get(orderId);
    if (!record || record.productType !== "single" || !record.reportId || !memory().reports.has(record.reportId)) {
      throw new EntitlementError("This payment is not attached to a generated report.");
    }
    memory().reports.set(record.reportId, true);
    return record.reportId;
  }
  const client = getServiceClient();
  const { data: order, error } = await client
    .from("report_orders")
    .select("report_id, product_type")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new SupabaseRequestError(error.message);
  if (!order || order.product_type !== "single" || !order.report_id) {
    throw new EntitlementError("This payment is not attached to a generated report.");
  }
  const { data: updated, error: updateError } = await client
    .from("reports")
    .update({ authorized: true, updated_at: new Date().toISOString() })
    .eq("id", order.report_id)
    .select("id")
    .maybeSingle();
  if (updateError) throw new SupabaseRequestError(updateError.message);
  if (!updated) throw new EntitlementError("This payment is not attached to a generated report.");
  return order.report_id;
}

/**
 * Authorizes a report without a Razorpay order — used when a pack credit is
 * spent for it. Still requires the report to have been genuinely generated.
 */
export async function authorizeReport(reportId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    if (!memory().reports.has(reportId)) {
      throw new EntitlementError("This report is not available for unlock.");
    }
    memory().reports.set(reportId, true);
    return;
  }
  const { data, error } = await getServiceClient()
    .from("reports")
    .update({ authorized: true, updated_at: new Date().toISOString() })
    .eq("id", reportId)
    .select("id")
    .maybeSingle();
  if (error) throw new SupabaseRequestError(error.message);
  if (!data) throw new EntitlementError("This report is not available for unlock.");
}

/** The one authoritative check used by report-access, PDF, and Wrapped surfaces. */
export async function isReportAuthorized(reportId: string): Promise<boolean> {
  if (!reportId) return false;
  if (!isSupabaseConfigured()) {
    return memory().reports.get(reportId) === true;
  }
  const { data, error } = await getServiceClient()
    .from("reports")
    .select("authorized")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new SupabaseRequestError(error.message);
  return data?.authorized === true;
}

/** Test-only reset of the in-memory fallback (tests never configure Supabase). */
export function resetEntitlementsForTests(): void {
  if (process.env.NODE_ENV === "test") {
    const current = memory();
    current.reports.clear();
    current.orders.clear();
  }
}
