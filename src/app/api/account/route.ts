import {
  bearerToken,
  getUserFromToken,
  isSupabaseConfigured,
  totalCredits,
} from "../../../lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Returns the signed-in user's remaining credit count. The count is ALWAYS
 * server-sourced — the client may cache it for UX but is never authoritative.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Accounts aren't available right now." }, { status: 503 });
  }
  const user = await getUserFromToken(bearerToken(request));
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  try {
    const credits = await totalCredits(user.id);
    return Response.json({ credits, email: user.email ?? null });
  } catch {
    return Response.json({ error: "We couldn't reach your account right now. Please try again." }, { status: 503 });
  }
}
