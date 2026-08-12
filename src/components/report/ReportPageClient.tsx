"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { parseReportSession, REPORT_SESSION_KEY } from "@/lib/reportSession";
import type { ReportSessionData } from "@/lib/types";

import { LockedReport } from "./LockedReport";

export function ReportPageClient() {
  const [report, setReport] = useState<ReportSessionData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(REPORT_SESSION_KEY);
    if (!saved) {
      setFailed(true);
      return;
    }
    try {
      setReport(parseReportSession(saved));
    } catch {
      setFailed(true);
    }
  }, []);

  if (report) {
    return <LockedReport report={report} />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#dcdcd7] px-6 py-12">
      <section className="w-full max-w-[430px] rounded-[32px] bg-[#f5f2f0] p-8 text-center shadow-editorial">
        <div className="text-3xl" aria-hidden="true">💕</div>
        <h1 className="mt-4 text-3xl font-black tracking-[-1px]">
          {failed ? "no report found" : "opening your lore…"}
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
    </main>
  );
}
