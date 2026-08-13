import type { Metadata } from "next";

import { CreateFunnel } from "@/components/funnel/CreateFunnel";

export const metadata: Metadata = {
  title: "make your lores · private WhatsApp report",
  description: "Choose an edition, export your WhatsApp chat, and make your private lores report.",
};

export default function CreateReportPage() {
  return <CreateFunnel />;
}
