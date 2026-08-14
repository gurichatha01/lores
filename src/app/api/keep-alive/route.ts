import { isSupabaseConfigured, pingDatabase } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keep-alive ping. A scheduled daily hit (see vercel.json cron) runs a trivial
 * query so the free-tier Supabase project doesn't pause on 7-day inactivity
 * during the build window. This is a BUILD/DEV SAFEGUARD only — the Pro tier is
 * the production guarantee once real buyers hold credits. Never rely on this to
 * protect live paid credits.
 *
 * Optional: set KEEP_ALIVE_SECRET to require `?secret=` on the request.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.KEEP_ALIVE_SECRET?.trim();
  if (secret) {
    const provided = new URL(request.url).searchParams.get("secret")?.trim();
    if (provided !== secret) {
      return Response.json({ ok: false }, { status: 401 });
    }
  }
  if (!isSupabaseConfigured()) {
    return Response.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }
  try {
    await pingDatabase();
    return Response.json({ ok: true, ts: Date.now() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
