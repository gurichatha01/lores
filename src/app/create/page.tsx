import type { Metadata } from "next";

import { CreateFunnel } from "@/components/funnel/CreateFunnel";

export const metadata: Metadata = {
  title: "make your lore — private WhatsApp report",
  description: "Choose an edition, export your WhatsApp chat, and make your private Lore report.",
};

export default function CreateReportPage() {
  return <CreateFunnel />;
}
