"use client";

import { useState } from "react";

import { createReportPdf, pdfFileName } from "@/lib/createReportPdf";
import { getModePreset } from "@/lib/modePresets";
import { buildPdfDocumentData, type PdfCanvas } from "@/lib/pdfReport";
import type { ReportSessionData } from "@/lib/types";

interface ReportPdfDownloadProps {
  report: ReportSessionData;
}

type Status = "idle" | "building" | "downloaded" | "failed";

export function ReportPdfDownload({ report }: ReportPdfDownloadProps) {
  const [status, setStatus] = useState<Status>("idle");
  const preset = getModePreset(report.mode);
  const pdfData = buildPdfDocumentData(report);
  const pageCount = 4 + pdfData.storyPages.length + pdfData.detailPages.length;

  async function download(): Promise<void> {
    if (status === "building") return;
    setStatus("building");
    try {
      await document.fonts?.ready;
      const pdf = createReportPdf(report, (width, height) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas as PdfCanvas;
      });
      pdf.save(pdfFileName(report));
      setStatus("downloaded");
    } catch {
      setStatus("failed");
    }
  }

  const label =
    status === "building"
      ? "building your keepsake…"
      : status === "downloaded"
        ? "keepsake downloaded ✓"
        : status === "failed"
          ? "try PDF again"
          : "download keepsake PDF 🎁";

  return (
    <section className="mt-8 border-t pt-6" style={{ borderColor: preset.border }}>
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] opacity-50">
        the keepsake edition · {pageCount} pages
      </p>
      <button
        type="button"
        onClick={download}
        disabled={status === "building"}
        aria-busy={status === "building"}
        className={`mt-3 min-h-14 w-full border-2 px-5 text-[14px] font-extrabold uppercase tracking-[0.01em] text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 ${
          preset.treatment === "soft" ? "rounded-full" : "rounded-[4px]"
        }`}
        style={{ background: preset.accent, borderColor: preset.accent }}
      >
        {label}
      </button>
      {status === "failed" ? (
        <p role="alert" className="mt-2 text-xs font-semibold" style={{ color: preset.accent }}>
          The PDF could not be created in this browser.
        </p>
      ) : null}
    </section>
  );
}
