import type { Metadata } from "next";

import { ContactEmail, LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Refund & Cancellation Policy · lores" };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy">
      <LegalSection title="Digital goods, delivered instantly">
        <p>lores reports and pack credits are digital products delivered immediately. Because of this:</p>
        <ul className="list-disc space-y-3 pl-5 marker:text-pink">
          <li><strong>Reports and pack credits are non-refundable once delivered.</strong> We do not offer refunds for change of mind, for dissatisfaction with AI-generated content, or for unused pack credits.</li>
        </ul>
      </LegalSection>
      <LegalSection title="The one exception, we failed to deliver">
        <p>If you were charged but a technical failure on our side prevented your report from being delivered or your pack credits from being applied, contact us at <ContactEmail /> with your payment reference. We will either resolve the issue so you receive what you paid for, or refund that specific payment.</p>
      </LegalSection>
      <LegalSection title="Cancellation">
        <p>There are no recurring subscriptions to cancel. A pack is a one-time purchase of ten report credits. You may delete your account at any time from your account page; deleting your account does not create a refund for unused credits.</p>
      </LegalSection>
      <LegalSection title="Contact"><p><ContactEmail /></p></LegalSection>
    </LegalPage>
  );
}
