import type { Metadata } from "next";

import { ReportPageClient } from "@/components/report";

export const metadata: Metadata = {
  title: "your lores · chat report",
  description: "Your private lores chat report.",
};

export default function ReportPage() {
  return <ReportPageClient />;
}
