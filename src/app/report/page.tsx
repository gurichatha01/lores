import type { Metadata } from "next";

import { ReportPageClient } from "@/components/report";

export const metadata: Metadata = {
  title: "your lore — chat report",
  description: "Your private Lore chat report.",
};

export default function ReportPage() {
  return <ReportPageClient />;
}
