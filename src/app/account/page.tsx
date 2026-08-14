import type { Metadata } from "next";

import { AccountClient } from "@/components/account/AccountClient";

export const metadata: Metadata = {
  title: "your pack — lores",
  description: "Manage your lores report pack.",
};

export default function AccountPage() {
  return <AccountClient />;
}
