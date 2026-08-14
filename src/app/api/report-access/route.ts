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
  return Response.json({ authorized: isReportAuthorized(reportId) });
}
