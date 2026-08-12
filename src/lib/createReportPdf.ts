import { jsPDF } from "jspdf";

import {
  PDF_PAGE_HEIGHT,
  PDF_PAGE_WIDTH,
  renderReportPdfPages,
  type PdfCanvasFactory,
} from "./pdfReport";
import type { ReportSessionData } from "./types";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export function createReportPdf(report: ReportSessionData, createCanvas: PdfCanvasFactory): jsPDF {
  const pages = renderReportPdfPages(report, createCanvas);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  pages.forEach((page, index) => {
    if (index > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(page.toDataURL("image/png"), "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, "FAST");
  });

  return pdf;
}

export function pdfFileName(report: ReportSessionData): string {
  return `lore-${report.mode}-keepsake.pdf`;
}
