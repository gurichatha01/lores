import {
  bearerToken,
  claimPack,
  getUserFromToken,
  isSupabaseConfigured,
} from "../../../lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Binds an unclaimed pack (by payment id) to the signed-in account. Idempotent:
 * a repeat claim by the same user is a no-op success; a claim of someone else's
 * purchase is refused. The binding is server-side with the service-role key.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured()) {
    return Response.json({ claimed: false, error: "Accounts aren't available right now. Please try again." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ claimed: false, error: "Request body must be valid JSON." }, { status: 400 });
  }
  const paymentId = (body as { paymentId?: unknown } | null)?.paymentId;
  if (typeof paymentId !== "string" || !paymentId) {
    return Response.json({ claimed: false, error: "Missing payment id." }, { status: 400 });
  }

  const user = await getUserFromToken(bearerToken(request));
  if (!user) {
    return Response.json({ claimed: false, error: "Please sign in to claim your reports." }, { status: 401 });
  }

  try {
    const result = await claimPack(paymentId, user.id);
    switch (result.status) {
      case "claimed":
      case "already_claimed":
        return Response.json({ claimed: true, credits: result.credits });
      case "claimed_by_other":
        return Response.json(
          { claimed: false, error: "These reports are already linked to another account." },
          { status: 409 },
        );
      default:
        return Response.json(
          { claimed: false, error: "We couldn't find that purchase yet. If you just paid, wait a moment and try again." },
          { status: 404 },
        );
    }
  } catch {
    return Response.json(
      { claimed: false, error: "We couldn't reach your account right now. Please try again." },
      { status: 503 },
    );
  }
}
