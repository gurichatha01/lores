import {
  bearerToken,
  compCredits,
  getUserFromToken,
  isSupabaseConfigured,
} from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

const NOT_FOUND = new Response("Not found", { status: 404 });

/**
 * Dev/comp path: grant credits without paying, for local testing and comping
 * friends during a soft launch. HARD GATE — physically unreachable in
 * production: it 404s unless NODE_ENV !== 'production' AND a valid
 * DEV_COMP_SECRET is presented. A comp endpoint reachable in prod would be
 * infinite free reports.
 */
export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return NOT_FOUND;
  }
  const secret = process.env.DEV_COMP_SECRET?.trim();
  const provided = request.headers.get("x-dev-comp-secret")?.trim();
  if (!secret || !provided || provided !== secret) {
    return NOT_FOUND;
  }
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const record = (body ?? {}) as { userId?: unknown; credits?: unknown };
  const credits = typeof record.credits === "number" && Number.isFinite(record.credits)
    ? Math.max(0, Math.trunc(record.credits))
    : 10;

  let userId = typeof record.userId === "string" && record.userId ? record.userId : null;
  if (!userId) {
    const user = await getUserFromToken(bearerToken(request));
    userId = user?.id ?? null;
  }
  if (!userId) {
    return Response.json(
      { error: "Provide a userId in the body, or a signed-in bearer token, to comp." },
      { status: 400 },
    );
  }

  try {
    const total = await compCredits(userId, credits);
    return Response.json({ ok: true, userId, credits: total });
  } catch {
    return Response.json({ error: "Could not set comp credits." }, { status: 500 });
  }
}
