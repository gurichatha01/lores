import Link from "next/link";

import { BrandWordmark } from "@/components/BrandWordmark";

/**
 * The one site-wide footer: privacy reassurance + Privacy/Terms/Refunds/
 * Contact links + wordmark. Used on every top-level page (landing, /create,
 * /report once unlocked, /account) so the legal pages are reachable from
 * everywhere, not just the homepage. Legal pages themselves keep their own
 * compact in-card nav (LegalPage) since it already cross-links this same set.
 */
export function SiteFooter() {
  return (
    <footer className="bg-surface px-5 py-8 sm:px-10 lg:px-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-md font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em] text-ink/45">
          parsed locally · only derived stats and a small curated message and receipt sample reach the writer
        </p>
        <nav aria-label="Legal pages" className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink/60">
          <Link href="/privacy" className="underline decoration-pink decoration-2 underline-offset-4 hover:text-ink">privacy</Link>
          <Link href="/terms" className="underline decoration-pink decoration-2 underline-offset-4 hover:text-ink">terms</Link>
          <Link href="/refunds" className="underline decoration-pink decoration-2 underline-offset-4 hover:text-ink">refunds</Link>
          <Link href="/contact" className="underline decoration-pink decoration-2 underline-offset-4 hover:text-ink">contact</Link>
        </nav>
        <BrandWordmark accent="#ff2d78" className="text-2xl font-black tracking-[-1px]" />
      </div>
    </footer>
  );
}
