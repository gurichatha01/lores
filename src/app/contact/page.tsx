import type { Metadata } from "next";

import { ContactEmail, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Contact · lores" };

export default function ContactPage() {
  return (
    <LegalPage title="Contact">
      <p>Questions, problems, or a payment that didn&apos;t deliver? Email us:</p>
      <p className="text-2xl font-black tracking-[-1px]"><ContactEmail /></p>
      <p>We read every message and aim to respond within a few business days. For payment issues, please include your payment reference so we can find your transaction quickly.</p>
    </LegalPage>
  );
}
