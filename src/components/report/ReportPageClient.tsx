"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { checkReportAuthorization } from "@/lib/reportAccess";
import { parseReportSession, REPORT_SESSION_KEY } from "@/lib/reportSession";
import type { ReportSessionData } from "@/lib/types";

import { LockedReport } from "./LockedReport";
import { ModeReport } from "./ModeReport";
import { ReportBackdrop } from "./ReportBackdrop";

export function ReportPageClient() {
  const [report, setReport] = useState<ReportSessionData | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(REPORT_SESSION_KEY);
    if (!saved) {
      setFailed(true);
      return;
    }
    try {
      const parsed = parseReportSession(saved);
      setReport(parsed);
      void refreshAuthorization(parsed.reportId);
    } catch {
      setFailed(true);
    }
  }, []);

  // The full report content is already in `report` (from sessionStorage). The
  // server only tells us whether it's unlocked; content never round-trips.
  async function refreshAuthorization(reportId: string): Promise<void> {
    setUnlocked(await checkReportAuthorization(reportId));
  }

  function handleUnlocked(): void {
    if (!report) return;
    void refreshAuthorization(report.reportId);
  }

  if (report) {
    return unlocked ? (
      <ModeReport report={report} />
    ) : (
      <LockedReport report={report} onUnlocked={handleUnlocked} />
    );
  }

  return (
    <ReportBackdrop accent="#2b2bef" accentSoft="#e5e5ff" background="#dcdcd7" centered>
      <section className="mx-auto w-full max-w-[430px] rounded-[32px] bg-[#f5f2f0] p-8 text-center shadow-editorial lg:max-w-[560px] lg:rounded-[8px] lg:border-2 lg:border-ink lg:p-12">
        <div className="text-3xl" aria-hidden="true">💕</div>
        <h1 className="mt-4 text-3xl font-black tracking-[-1px]">
          {failed ? "no report found" : "opening your lores…"}
        </h1>
        {failed ? (
          <>
            <p className="mt-3 text-sm font-medium leading-relaxed text-ink/60">
              Generate a report in this tab first. Saved reports stay only for this browser session.
            </p>
            <Link
              href="/create"
              className="mt-6 inline-flex min-h-14 items-center justify-center rounded-full bg-sweetheart px-6 font-extrabold text-white"
            >
              choose a chat →
            </Link>
          </>
        ) : null}
      </section>
    </ReportBackdrop>
  );
}
