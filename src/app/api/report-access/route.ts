import { isReportAuthorized } from "../../../lib/entitlements";

export const runtime = "nodejs";

/** Server-authoritative gate for every full report and export surface. */
export async function POST(request: Request): Promise<Response> {
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
  try {
    return Response.json({ authorized: await isReportAuthorized(reportId) });
  } catch {
    // Never fall back to granting access when the store can't be reached.
    return Response.json({ authorized: false, error: "We couldn't reach your report right now. Please try again." }, { status: 503 });
  }
}
