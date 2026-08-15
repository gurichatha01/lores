import Link from "next/link";

import { BrandWordmark } from "@/components/BrandWordmark";
import { LegalBackLink } from "@/components/legal/LegalBackLink";

interface LegalPageProps {
  title: string;
  children: React.ReactNode;
}

const legalLinks = [
  { href: "/privacy", label: "privacy" },
  { href: "/terms", label: "terms" },
  { href: "/refunds", label: "refunds" },
  { href: "/contact", label: "contact" },
] as const;

export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-surface px-5 py-6 text-ink sm:px-10 sm:py-10 lg:px-14">
      <article className="mx-auto max-w-3xl border-2 border-ink bg-white p-6 shadow-editorial sm:p-10 lg:p-12">
        <header className="border-b-2 border-ink pb-5">
          <LegalBackLink />
          <div className="mt-4 flex items-center justify-between gap-5">
            <Link href="/" aria-label="Back to lores home">
              <BrandWordmark accent="#ff2d78" className="text-3xl font-black tracking-[-1px]" />
            </Link>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/50">legal</p>
          </div>
          <p className="mt-10 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-pink">lores.in</p>
          <h1 className="mt-3 text-4xl font-black leading-none tracking-[-2px] sm:text-5xl">{title}</h1>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink/55">last updated: August 14, 2026</p>
        </header>

        <div className="space-y-9 py-9 text-[16px] font-medium leading-[1.7] text-ink/80 sm:text-[17px]">{children}</div>

        <footer className="border-t-2 border-ink pt-5">
          <nav aria-label="Legal pages" className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="underline decoration-pink decoration-2 underline-offset-4 hover:text-pink">
                {link.label}
              </Link>
            ))}
          </nav>
        </footer>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-pink">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

export function ContactEmail() {
  return <a href="mailto:chathags@outlook.com" className="font-semibold text-pink underline decoration-2 underline-offset-4">chathags@outlook.com</a>;
}
