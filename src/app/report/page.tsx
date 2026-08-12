import type { Metadata } from "next";

import { ReportPageClient } from "@/components/report";

export const metadata: Metadata = {
  title: "your lore — sweetheart report",
  description: "Your private Sweetheart chat report.",
};

export default function ReportPage() {
  return <ReportPageClient />;
}
