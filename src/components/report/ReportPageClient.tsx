"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { checkReportAuthorization } from "@/lib/reportAccess";
import { downloadReportPdf } from "@/lib/reportPdfDownload";
import { cacheReportLocally, readCachedReport } from "@/lib/reportPersistence";
import { parseReportSession, REPORT_SESSION_KEY } from "@/lib/reportSession";
import type { ReportSessionData } from "@/lib/types";

import { LockedReport } from "./LockedReport";
import { ModeReport } from "./ModeReport";
import { ReportBackdrop } from "./ReportBackdrop";

export function ReportPageClient() {
  const [report, setReport] = useState<ReportSessionData | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const autoDownloadedRef = useRef(false);

  useEffect(() => {
    // sessionStorage is the primary, tab-local copy written at generation
    // time. It's cleared when the tab closes, so a same-browser localStorage
    // mirror (content only — see reportPersistence.ts) covers a refresh, a
    // reopened tab, or a restarted browser losing the keepsake. Whichever
    // source has it, we resync both so they never drift apart.
    const saved = window.sessionStorage.getItem(REPORT_SESSION_KEY);
    let parsed: ReportSessionData | null = null;
    try {
      parsed = saved ? parseReportSession(saved) : null;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      parsed = readCachedReport();
      if (parsed) {
        window.sessionStorage.setItem(REPORT_SESSION_KEY, JSON.stringify(parsed));
      }
    }
    if (!parsed) {
      setFailed(true);
      return;
    }
    setReport(parsed);
    cacheReportLocally(parsed);
    void refreshAuthorization(parsed.reportId);
  }, []);

  // The full report content is already in `report` (from session/local
  // storage). The server only tells us whether it's unlocked; content never
  // round-trips.
  async function refreshAuthorization(reportId: string): Promise<void> {
    setUnlocked(await checkReportAuthorization(reportId));
  }

  // Fires only on the live unlock transition (a real payment/credit spend
  // just verified server-side), never on a routine revisit of an
  // already-unlocked report — so a paying customer gets their keepsake
  // immediately without a second click, but reopening the report later
  // doesn't re-trigger a surprise download every time. downloadReportPdf
  // re-checks authorization itself before building anything.
  function handleUnlocked(): void {
    if (!report) return;
    void refreshAuthorization(report.reportId);
    if (!autoDownloadedRef.current) {
      autoDownloadedRef.current = true;
      void downloadReportPdf(report);
    }
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
              Generate a report first. Saved reports stay only on this device and browser.
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
