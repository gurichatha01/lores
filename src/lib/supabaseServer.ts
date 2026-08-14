import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Server-only Supabase access. Holds the SERVICE ROLE key and performs every
 * credit mutation. This module must never be imported from a client component —
 * the service role bypasses RLS and can read/write any row. All ledger writes
 * go through the SQL functions in supabase/migrations/0001_pack_credits.sql so
 * they stay atomic.
 */

export class SupabaseConfigError extends Error {
  constructor(message = "Supabase is not configured.") {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export class SupabaseRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseRequestError";
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

let cachedClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new SupabaseConfigError();
  }
  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/** Verifies a Supabase Auth access token and returns its user, or null. */
export async function getUserFromToken(token: string | null | undefined): Promise<User | null> {
  const jwt = token?.trim();
  if (!jwt) return null;
  const { data, error } = await getServiceClient().auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user;
}

/** Extracts a bearer token from an Authorization header. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Writes an UNCLAIMED pack row after a verified pack payment. Idempotent on
 * payment_id: a duplicate write (double verify) is a no-op, never a second pack.
 */
export async function writeUnclaimedPack(params: {
  paymentId: string;
  credits: number;
  amount: number;
}): Promise<void> {
  const { error } = await getServiceClient().from("pack_credits").insert({
    payment_id: params.paymentId,
    credits_remaining: params.credits,
    amount: params.amount,
    user_id: null,
  });
  // 23505 = unique_violation on payment_id → already recorded, treat as success.
  if (error && error.code !== "23505") {
    throw new SupabaseRequestError(error.message);
  }
}

export type ClaimResult =
  | { status: "claimed" | "already_claimed"; credits: number }
  | { status: "not_found" | "claimed_by_other" };

/** Atomically binds a payment_id's credits to a user. Idempotent, one-time. */
export async function claimPack(paymentId: string, userId: string): Promise<ClaimResult> {
  const { data, error } = await getServiceClient().rpc("claim_pack", {
    p_payment_id: paymentId,
    p_user_id: userId,
  });
  if (error) throw new SupabaseRequestError(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { credits_remaining: number | null; status: string }
    | undefined;
  const status = row?.status;
  if (status === "claimed" || status === "already_claimed") {
    return { status, credits: row?.credits_remaining ?? 0 };
  }
  if (status === "claimed_by_other") return { status: "claimed_by_other" };
  return { status: "not_found" };
}

/** Atomically spends one credit. Returns the new remaining count, or -1 if none. */
export async function spendCredit(userId: string): Promise<number> {
  const { data, error } = await getServiceClient().rpc("spend_pack_credit", {
    p_user_id: userId,
  });
  if (error) throw new SupabaseRequestError(error.message);
  return typeof data === "number" ? data : -1;
}

/** Sum of remaining credits across any packs the user owns. */
export async function totalCredits(userId: string): Promise<number> {
  const { data, error } = await getServiceClient().rpc("total_pack_credits", {
    p_user_id: userId,
  });
  if (error) throw new SupabaseRequestError(error.message);
  return typeof data === "number" ? data : 0;
}

/**
 * Grants/sets credits WITHOUT payment for the dev/comp path. Upserts a synthetic
 * row keyed by a comp payment id so it never collides with real purchases.
 */
export async function compCredits(userId: string, credits: number): Promise<number> {
  const client = getServiceClient();
  const paymentId = `comp_${userId}`;
  const { error } = await client
    .from("pack_credits")
    .upsert(
      {
        payment_id: paymentId,
        user_id: userId,
        credits_remaining: credits,
        amount: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "payment_id" },
    );
  if (error) throw new SupabaseRequestError(error.message);
  return totalCredits(userId);
}

/** Deletes the auth user and their pack rows (FK also cascades). */
export async function deleteAccount(userId: string): Promise<void> {
  const client = getServiceClient();
  const { error: rowError } = await client.from("pack_credits").delete().eq("user_id", userId);
  if (rowError) throw new SupabaseRequestError(rowError.message);
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw new SupabaseRequestError(error.message);
}

/** Lightweight liveness probe for the keep-alive ping. */
export async function pingDatabase(): Promise<void> {
  const { error } = await getServiceClient()
    .from("pack_credits")
    .select("id", { count: "exact", head: true });
  if (error) throw new SupabaseRequestError(error.message);
}
