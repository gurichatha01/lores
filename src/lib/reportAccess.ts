import { parseReportSession } from "./reportSession";
import type { ReportSessionData } from "./types";

/** Client-side request only. The server remains the authorization authority. */
export async function checkReportAuthorization(reportId: string): Promise<boolean> {
  if (!reportId) return false;
  try {
    const response = await fetch("/api/report-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { authorized?: unknown } | null;
    return response.ok && body?.authorized === true;
  } catch {
    return false;
  }
}

/** Fetches a complete report only after the server has rechecked its entitlement. */
export async function fetchAuthorizedReport(reportId: string): Promise<ReportSessionData | null> {
  if (!reportId) return null;
  try {
    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { report?: unknown };
    if (!body.report) return null;
    const report = parseReportSession(JSON.stringify(body.report));
    return report.reportId === reportId ? report : null;
  } catch {
    return null;
  }
}
