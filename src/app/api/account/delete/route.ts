import {
  bearerToken,
  deleteAccount,
  getUserFromToken,
  isSupabaseConfigured,
} from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Deletes the signed-in account: removes the Supabase auth user and their
 * pack_credits rows (the FK also cascades). Table stakes for a privacy product.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured()) {
    return Response.json({ deleted: false, error: "Accounts aren't available right now." }, { status: 503 });
  }
  const user = await getUserFromToken(bearerToken(request));
  if (!user) {
    return Response.json({ deleted: false, error: "Not signed in." }, { status: 401 });
  }
  try {
    await deleteAccount(user.id);
    return Response.json({ deleted: true });
  } catch {
    return Response.json(
      { deleted: false, error: "We couldn't delete your account right now. Please try again." },
      { status: 503 },
    );
  }
}
