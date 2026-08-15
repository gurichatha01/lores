import { getPendingPackStatus, isSupabaseConfigured } from "../../../lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Unauthenticated, read-only check: is this payment id a real, still-unclaimed
 * pack purchase? This is the ONLY thing that may authorize showing the
 * "you've got 10 reports" signup prompt from a client-side localStorage stash.
 * A stash by itself proves nothing — it can be stale (already claimed on
 * another device or a previous session) or bogus. Never trust it directly.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured()) {
    return Response.json({ pending: false, error: "Accounts aren't available right now." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ pending: false, error: "Request body must be valid JSON." }, { status: 400 });
  }
  const paymentId = (body as { paymentId?: unknown } | null)?.paymentId;
  if (typeof paymentId !== "string" || !paymentId) {
    return Response.json({ pending: false, error: "Missing payment id." }, { status: 400 });
  }

  try {
    const status = await getPendingPackStatus(paymentId);
    return Response.json(status);
  } catch {
    // Never fall back to "pending" when the store can't be reached — that
    // would risk resurrecting a stale/claimed stash as a false prompt.
    return Response.json(
      { pending: false, error: "We couldn't reach your account right now. Please try again." },
      { status: 503 },
    );
  }
}
