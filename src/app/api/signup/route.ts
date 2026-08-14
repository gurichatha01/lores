import { createClient } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "../../../lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Server-side signup for the pack success screen. Uses the admin API with
 * email_confirm: true so the buyer gets an account immediately — no email
 * round-trip, which matches the brief's "success screen IS signup, no deferral"
 * and its no-mail-provider scope. The client then signs in with the same
 * password to obtain a session. Email is stored only for return/recovery; it is
 * intentionally unverified at this launch scope.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured()) {
    return Response.json({ ok: false, error: "Accounts aren't available right now." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 });
  }
  const record = (body ?? {}) as { email?: unknown; password?: unknown };
  const email = typeof record.email === "string" ? record.email.trim() : "";
  const password = typeof record.password === "string" ? record.password : "";
  if (!email || !email.includes("@")) {
    return Response.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ ok: false, error: "Use a password of at least 8 characters." }, { status: 400 });
  }

  const admin = createClient(
    process.env.SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || error.status === 422) {
      return Response.json(
        { ok: false, code: "exists", error: "That email already has an account. Log in instead." },
        { status: 409 },
      );
    }
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
