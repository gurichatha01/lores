/**
 * Client-side authorization check only. The server remains the authority; the
 * report CONTENT already lives in this browser's sessionStorage (it never went
 * to the server store), so all we need from the server is whether this report
 * has been unlocked.
 */
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
