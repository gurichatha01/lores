import Link from "next/link";

import { BrandWordmark } from "@/components/BrandWordmark";
import { HeaderAccountLink } from "@/components/account/HeaderAccountLink";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { SiteFooter } from "@/components/SiteFooter";
import { getModePreset, REPORT_MODES } from "@/lib/modePresets";

const credibilitySlots = [
  "real customer story",
  "verified creator quote",
  "press or trust mark",
] as const;
const SHOW_CREDIBILITY_SECTION = false;

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <section className="mx-auto flex min-h-[760px] max-w-6xl flex-col px-5 pb-12 pt-6 sm:px-10 sm:pt-10 lg:px-14">
        <header className="flex items-center justify-between border-b-2 border-ink pb-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
            upload your chat
          </p>
          <div className="flex items-center gap-4">
            <p className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-group sm:block">
              chat stays on your device
            </p>
            <HeaderAccountLink className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/55 underline underline-offset-2 transition-colors hover:text-ink" />
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink/45">
              the story hiding in your messages
            </p>
            <h1 className="mt-4 text-[clamp(5.8rem,27vw,10rem)] font-black leading-[0.75] tracking-[-7px] sm:tracking-[-9px]">
              <BrandWordmark accent="#ff2d78" />
            </h1>
            <p className="mt-7 max-w-xl text-[clamp(1.4rem,5vw,2.25rem)] font-semibold leading-[1.12] tracking-[-1px]">
              upload your chat.<br />
              get <span className="bg-pink px-1.5 text-white">lores</span> · every stat nobody remembers.
            </p>
            <Link
              href="/create"
              className="mt-8 flex min-h-16 w-full max-w-md items-center justify-center bg-ink px-6 text-[17px] font-extrabold uppercase tracking-[0.02em] text-surface transition-colors transition-transform hover:-translate-y-0.5 hover:bg-pink"
            >
              get my lores <span className="ml-2 font-mono text-acid">→</span>
            </Link>
            <PrivacyBadge accent="#ff2d78" tint="#fdeef4" className="mt-4 w-full max-w-md" />
          </div>

          <div>
            <div className="flex items-end justify-between border-b-2 border-ink pb-2">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">the range</h2>
              <span className="font-mono text-[10px] text-ink/45">06 editions ↓</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {REPORT_MODES.map((mode, index) => {
                const preset = getModePreset(mode);
                return (
                  <div
                    key={mode}
                    className="min-h-28 border-2 border-ink p-3.5"
                    style={{
                      background: index === 2 ? preset.accent : preset.card,
                      color: index === 2 ? "#ffffff" : preset.text,
                    }}
                  >
                    <p
                      className="font-mono text-[9px] font-bold uppercase tracking-[0.08em]"
                      style={{ color: index === 2 ? "#ccff00" : preset.accent }}
                    >
                      {preset.emoji} edition {String(index + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-4 text-lg font-black leading-none tracking-[-0.5px]">{preset.label}</p>
                    <p className="mt-2 text-[11px] font-semibold opacity-60">{preset.note}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />

      {SHOW_CREDIBILITY_SECTION ? (
        <section className="border-y-2 border-ink bg-white px-5 py-12 sm:px-10 lg:px-14" aria-labelledby="credibility-title">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between border-b-2 border-ink pb-2">
              <h2 id="credibility-title" className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
                real proof belongs here
              </h2>
              <span className="font-mono text-[9px] uppercase text-ink/40">placeholders only · phase 9</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {credibilitySlots.map((slot, index) => (
                <div key={slot} className="flex min-h-36 flex-col justify-between border-2 border-dashed border-hairline p-4">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink/35">
                    placeholder {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="max-w-[16rem] text-lg font-black tracking-[-0.5px] text-ink/35">{slot}</p>
                  <p className="font-mono text-[9px] uppercase text-ink/30">never fabricated</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <SiteFooter />
    </main>
  );
}
