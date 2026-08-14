import {
  assertReportAvailable,
  authorizeReport,
  EntitlementError,
  isReportAuthorized,
} from "../../../lib/entitlements";
import {
  bearerToken,
  getUserFromToken,
  isSupabaseConfigured,
  spendCredit,
  totalCredits,
} from "../../../lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Spends one pack credit to unlock an already-generated report. Called by a
 * signed-in pack user AFTER generation succeeds (so a Gemini failure never
 * consumes a credit — the client only reaches here on a 200 report). The
 * decrement is atomic in Postgres and can never go below zero. Idempotent per
 * report: if the report is already unlocked, no second credit is spent.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured()) {
    return Response.json({ authorized: false, error: "Accounts aren't available right now." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ authorized: false, error: "Request body must be valid JSON." }, { status: 400 });
  }
  const reportId = (body as { reportId?: unknown } | null)?.reportId;
  if (typeof reportId !== "string" || !reportId) {
    return Response.json({ authorized: false, error: "Missing report identity." }, { status: 400 });
  }

  const user = await getUserFromToken(bearerToken(request));
  if (!user) {
    return Response.json({ authorized: false, error: "Please sign in to spend a credit." }, { status: 401 });
  }

  try {
    assertReportAvailable(reportId);
  } catch {
    return Response.json({ authorized: false, error: "This report isn't available to unlock." }, { status: 404 });
  }

  // Already unlocked (e.g. a retried request): return success without spending.
  if (isReportAuthorized(reportId)) {
    try {
      const credits = await totalCredits(user.id);
      return Response.json({ authorized: true, creditsRemaining: credits });
    } catch {
      return Response.json({ authorized: true });
    }
  }

  // Spend first, authorize only on a committed decrement. Safe against the
  // 0-credit case (no authorization ever happens without a real decrement).
  let remaining: number;
  try {
    remaining = await spendCredit(user.id);
  } catch {
    return Response.json(
      { authorized: false, error: "We couldn't reach your account right now. Please try again." },
      { status: 503 },
    );
  }

  if (remaining < 0) {
    return Response.json(
      { authorized: false, creditsRemaining: 0, error: "Your pack is used up — grab another to keep going." },
      { status: 402 },
    );
  }

  try {
    authorizeReport(reportId);
  } catch (error) {
    // The report vanished between the availability check and here — extremely
    // rare. The credit was spent; surface a retryable error.
    if (error instanceof EntitlementError) {
      return Response.json(
        { authorized: false, error: "We couldn't unlock that report. Please contact support." },
        { status: 500 },
      );
    }
    throw error;
  }

  return Response.json({ authorized: true, creditsRemaining: remaining });
}
