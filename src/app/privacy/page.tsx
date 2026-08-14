import type { Metadata } from "next";

import { ContactEmail, LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · lores" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>lores (&quot;lores.in&quot;, &quot;we&quot;, &quot;us&quot;) is a tool that turns an exported chat into a written report about a relationship or group. Privacy is central to how the product is built. This policy explains, plainly, what we do and do not handle.</p>
      <LegalSection title="Your chat is processed on your device">
        <p>When you upload an exported chat, the parsing and analysis happen entirely in your browser. Your raw chat, the actual messages, is never uploaded to our servers and is never stored by us. It stays on your device.</p>
        <p>To write your report, we send a limited, derived payload to our AI provider: anonymised statistics (counts, timings, and similar aggregates) and a small sample of messages needed to make the writing specific. We do not retain this payload after your report is generated.</p>
      </LegalSection>
      <LegalSection title="What we store">
        <ul className="list-disc space-y-3 pl-5 marker:text-pink">
          <li><strong>Single reports (₹99):</strong> No account is required and we store no personal information about you. The generated report is held in your browser, not in our database.</li>
          <li><strong>10-report packs (₹499):</strong> To let you return and use your remaining reports, a pack creates an account. For that account we store your email address and the number of reports you have left. We do not store your chats or your generated reports.</li>
          <li><strong>Payments:</strong> Payments are processed by Razorpay. We receive confirmation that a payment succeeded and a payment reference; we do not receive or store your full card details. Razorpay handles payment information under its own policies.</li>
        </ul>
        <p>We do not sell your data. We do not use your chats for advertising.</p>
      </LegalSection>
      <LegalSection title="Cookies and sessions">
        <p>For pack accounts, we use a login session (a cookie/token) so you stay signed in. We do not use advertising or cross-site tracking cookies. If we add analytics in future, we will update this policy.</p>
      </LegalSection>
      <LegalSection title="Deleting your account and data">
        <p>If you have a pack account, you can delete it at any time from your account page. Deleting your account removes your login and your remaining-reports record from our systems. You can also contact us at <ContactEmail /> to request deletion.</p>
      </LegalSection>
      <LegalSection title="Contact"><p>Questions about privacy: <ContactEmail /></p></LegalSection>
    </LegalPage>
  );
}
