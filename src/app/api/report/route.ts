import { getAuthorizedReport } from "../../../lib/entitlements";

export const runtime = "nodejs";

/** Delivers the complete report only after server-side per-report authorization. */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const reportId = (body as { reportId?: unknown } | null)?.reportId;
  if (typeof reportId !== "string" || !reportId) {
    return Response.json({ error: "Missing report identity." }, { status: 400 });
  }

  const report = getAuthorizedReport(reportId);
  if (!report) {
    return Response.json({ error: "This report is still locked." }, { status: 403 });
  }
  return Response.json({ report });
}
