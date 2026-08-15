"use client";

import { createReportPdf, pdfFileName } from "./createReportPdf";
import { type PdfCanvas } from "./pdfReport";
import { checkReportAuthorization } from "./reportAccess";
import type { ReportSessionData } from "./types";

/**
 * Builds and downloads the keepsake PDF client-side. Re-checks server
 * authorization immediately before building — the same per-report gate every
 * export surface already uses — so this can never hand out an unpaid report,
 * whether triggered by the on-screen button or automatically on unlock.
 * Returns whether the download actually started.
 */
export async function downloadReportPdf(report: ReportSessionData): Promise<boolean> {
  if (!(await checkReportAuthorization(report.reportId))) {
    return false;
  }
  await document.fonts?.ready;
  const pdf = createReportPdf(report, (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas as PdfCanvas;
  });
  pdf.save(pdfFileName(report));
  return true;
}
