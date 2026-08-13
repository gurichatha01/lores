import Link from "next/link";

import { AwardBadge, StatCard } from "@/components/ui";
import { ReceiptSnippet } from "@/components/report/ReceiptSnippet";
import { ReportBackdrop } from "@/components/report/ReportBackdrop";
import {
  buildSweetheartStatCards,
  formatCount,
  formatLocalReportDate,
  formatNovelsComparison,
  formatParticipantTitle,
  formatSpanLabel,
} from "@/lib/reportPresentation";
import type { ReportSessionData } from "@/lib/types";

interface SweetheartReportProps {
  report: ReportSessionData;
}

export function SweetheartReport({ report }: SweetheartReportProps) {
  const { awards, content, stats } = report;
  const names = formatParticipantTitle(stats.people);
  const awardLines = new Map(content.awardLines.map((line) => [line.awardId, line.line]));
  const cards = buildSweetheartStatCards(stats);
  const novelsComparison = formatNovelsComparison(stats.novelsEquivalent);

  return (
    <ReportBackdrop accent="#f0568a" accentSoft="#fdeef4" background="#dcdcd7">
      <article className="mx-auto min-h-screen max-w-[430px] overflow-hidden border-[#f2dbe3] bg-[#f5f2f0] px-6 pb-10 pt-6 shadow-editorial sm:min-h-0 sm:rounded-[44px] sm:px-7 sm:pb-12 sm:pt-8 lg:max-w-[760px] lg:border lg:px-12 lg:pb-16 lg:pt-12">
        <header className="flex items-center justify-between pb-2">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-sweetheart">
            💕 sweetheart · {names}
          </div>
          <Link href="/create" className="font-mono text-[11px] font-bold text-sweetheart">
            ← new
          </Link>
        </header>

        <section className="mt-3" aria-labelledby="report-hero">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">
            {formatSpanLabel(stats.spanDays)}
          </p>
          <h1 id="report-hero" className="mt-2 text-[clamp(4.3rem,20vw,5.7rem)] font-black leading-[0.82] tracking-[-4px]">
            {formatCount(stats.totalMessages)}
          </h1>
          <p className="mt-4 text-base font-semibold leading-[1.35]">
            <span className="rounded bg-[#ffd9e6] px-1.5">
              {formatCount(stats.totalWords)} words
              {novelsComparison ? ` · ${novelsComparison}` : ""}
            </span>
            {" · "}{formatCount(stats.spanDays)} days of showing up in the chat.
          </p>
          <p className="mt-3 text-[15px] font-medium leading-relaxed text-ink/70">{content.heroLine}</p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-2.5" aria-label="Chat statistics">
          {cards.map((card) => (
            <StatCard
              key={card.label}
              treatment="soft"
              label={card.label}
              value={card.value}
              detail={card.detail}
              className="min-h-[116px]"
            />
          ))}
        </section>

        <ReportSectionLabel>the awards 🫶</ReportSectionLabel>
        <section className="flex flex-col gap-2.5" aria-label="Chat awards">
          {awards.map((award) => (
            <AwardBadge
              key={award.id}
              treatment="soft"
              highlighted={award.id === "main-character"}
              emoji={award.emoji}
              label={award.label}
              detail={
                <>
                  <span className="font-bold text-ink/70">{award.who}</span>
                  {" — "}{awardLines.get(award.id)}
                </>
              }
              className="px-4 py-3"
            />
          ))}
        </section>

        {content.highlights.length > 0 ? (
          <>
            <ReportSectionLabel>the moments</ReportSectionLabel>
            <section
              className="flex flex-col gap-4 rounded-[18px] border border-[#f2dbe3] bg-white p-4 shadow-sweetheart"
              aria-label="Chat highlights"
            >
              {content.highlights.map((highlight, index) => (
                <div
                  key={`${highlight.label}-${index}`}
                  className={index === 0 ? "" : "border-t border-[#f2dbe3] pt-4"}
                >
                  <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink/45">
                    {highlight.label}
                  </h2>
                  <p className="mt-2.5 text-sm font-medium leading-relaxed text-ink/70">{highlight.body}</p>
                  <ReceiptSnippet
                    snippet={highlight.snippet}
                    accent="#f0568a"
                    accentSoft="#fdeef4"
                    text="#0a0a0a"
                    muted="rgba(10,10,10,.52)"
                  />
                </div>
              ))}
            </section>
          </>
        ) : null}

        <ReportSectionLabel accent>your story, in full</ReportSectionLabel>
        <section aria-labelledby="story-title">
          <h2 id="story-title" className="text-[30px] font-black leading-[0.98] tracking-[-1px]">
            {content.title}
          </h2>
          <p className="mt-4 whitespace-pre-line text-[15px] font-medium leading-[1.6]">{content.narrative}</p>
        </section>

        <footer className="mt-8 border-t border-[#f2dbe3] pt-4">
          <div className="flex items-end justify-between gap-4">
            <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em] text-ink/40">
              {formatLocalReportDate(stats.firstMessageDate.slice(0, 10))}
              {" — "}
              {formatLocalReportDate(stats.lastMessageDate.slice(0, 10))}
              <br />built from a locally parsed export
            </p>
            <div className="text-2xl font-black tracking-[-1px]">
              lores<span className="text-pink">_</span>
            </div>
          </div>
        </footer>
      </article>
    </ReportBackdrop>
  );
}

function ReportSectionLabel({
  accent = false,
  children,
}: {
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mb-3 mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
        accent ? "text-sweetheart" : "text-ink/45"
      }`}
    >
      {children}
    </div>
  );
}
