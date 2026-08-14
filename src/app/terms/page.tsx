import type { Metadata } from "next";

import { ContactEmail, LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · lores" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>These terms govern your use of lores.in (&quot;lores&quot;, &quot;we&quot;, &quot;us&quot;). By using the site or purchasing a report or pack, you agree to them.</p>
      <LegalSection title="What lores is"><p>lores generates a written report from an exported chat you provide. Reports are produced using automated AI systems based on the data you upload. Because reports are AI-generated, they are intended as entertainment and keepsakes, and may contain inaccuracies or interpretations you disagree with. They are not statements of fact about any person.</p></LegalSection>
      <LegalSection title="Your responsibilities">
        <ul className="list-disc space-y-3 pl-5 marker:text-pink">
          <li>You must have the right to use and upload the chat you provide.</li>
          <li>You must not use lores to harass, defame, or harm any person, or for any unlawful purpose.</li>
          <li>You are responsible for how you share any report you generate.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Purchases">
        <ul className="list-disc space-y-3 pl-5 marker:text-pink">
          <li>A single report unlocks one report. A 10-report pack provides ten report credits tied to the account you create at purchase.</li>
          <li>Prices are shown at checkout. Payments are handled by Razorpay.</li>
          <li>Pack credits are tied to your account and are for your use.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Refunds"><p>Refunds are governed by our Refund &amp; Cancellation Policy.</p></LegalSection>
      <LegalSection title="Availability and changes"><p>We may update, change, or discontinue features. We aim to keep the service working but do not guarantee uninterrupted availability. If a technical failure on our side prevents delivery of something you paid for, see the Refund &amp; Cancellation Policy.</p></LegalSection>
      <LegalSection title="Limitation"><p>To the extent permitted by law, lores is provided &quot;as is&quot;. We are not liable for how reports are interpreted, shared, or used, or for indirect or consequential losses.</p></LegalSection>
      <LegalSection title="Contact"><p><ContactEmail /></p></LegalSection>
    </LegalPage>
  );
}
