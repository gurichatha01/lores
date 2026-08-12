import Link from "next/link";

import { WrappedCard } from "@/components/cards/WrappedCard";
import { ReportPdfDownload } from "@/components/pdf/ReportPdfDownload";
import { getModePreset } from "@/lib/modePresets";
import {
  buildModeStatCards,
  formatCount,
  formatLocalReportDate,
  formatNovelsComparison,
  formatSpanLabel,
} from "@/lib/reportPresentation";
import type { ReportSessionData } from "@/lib/types";

interface ModeReportProps {
  report: ReportSessionData;
}

export function ModeReport({ report }: ModeReportProps) {
  const { awards, content, stats } = report;
  const preset = getModePreset(report.mode);
  const soft = preset.treatment === "soft";
  const dark = preset.treatment === "dark";
  const names = stats.people.map((person) => person.name);
  const awardLines = new Map(content.awardLines.map((line) => [line.awardId, line.line]));
  const cards = buildModeStatCards(report.mode, stats);
  const novelsComparison = formatNovelsComparison(stats.novelsEquivalent);

  return (
    <main
      className="min-h-screen px-0 py-0 sm:px-6 sm:py-10"
      style={{ background: dark ? "#080706" : "#dcdcd7" }}
    >
      <article
        className={`mx-auto min-h-screen max-w-[430px] overflow-hidden px-6 pb-10 pt-6 shadow-editorial sm:min-h-0 sm:px-7 sm:pb-12 sm:pt-8 ${
          soft ? "sm:rounded-[44px]" : "sm:rounded-[8px]"
        }`}
        style={{ background: preset.surface, color: preset.text }}
        data-report-mode={report.mode}
        data-report-treatment={preset.treatment}
      >
        {dark ? <WarningTape accent={preset.accent} /> : null}
        <header className="flex items-center justify-between pb-2">
          <div
            className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]"
            style={{ color: preset.accent }}
          >
            {preset.emoji} {preset.label} · {names.join(" & ")}
          </div>
          <Link
            href="/create"
            className="font-mono text-[11px] font-bold"
            style={{ color: preset.accent }}
          >
            ← new
          </Link>
        </header>

        <section className="mt-3" aria-labelledby="report-hero">
          <p
            className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: preset.muted }}
          >
            {formatSpanLabel(stats.spanDays)}
          </p>
          <h1
            id="report-hero"
            className="mt-2 text-[clamp(4.3rem,20vw,5.7rem)] font-black leading-[0.82] tracking-[-4px]"
            style={{ color: dark ? preset.accent : preset.text }}
          >
            {formatCount(stats.totalMessages)}
          </h1>
          <p className="mt-4 text-base font-semibold leading-[1.35]">
            <span className="px-1.5" style={{ background: preset.accentSoft }}>
              {formatCount(stats.totalWords)} words
              {novelsComparison ? ` · ${novelsComparison}` : ""}
            </span>
            {" · "}
            {formatCount(stats.spanDays)} days of showing up in the chat.
          </p>
          <p className="mt-3 text-[15px] font-medium leading-relaxed" style={{ color: preset.muted }}>
            {content.heroLine}
          </p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-2.5" aria-label="Chat statistics">
          {cards.map((card) => (
            <div
              key={card.label}
              className={`min-h-[116px] p-3 ${
                soft ? "rounded-[18px] shadow-sweetheart" : dark ? "rounded-[10px]" : "border-2"
              }`}
              style={{
                background: preset.card,
                border: `${soft || dark ? 1 : 2}px solid ${preset.border}`,
              }}
            >
              <div
                className="font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                style={{ color: preset.muted }}
              >
                {card.label}
              </div>
              <div
                className="my-1 break-words text-[30px] font-black leading-none tracking-[-1px]"
                style={{ color: preset.accent }}
              >
                {card.value}
              </div>
              <div className="text-[11px] font-semibold leading-snug">{card.detail}</div>
            </div>
          ))}
        </section>

        <ReportSectionLabel color={preset.muted}>the awards {preset.emoji}</ReportSectionLabel>
        <section className="flex flex-col gap-2.5" aria-label="Chat awards">
          {awards.map((award) => {
            const highlighted = award.id === "main-character";
            return (
              <div
                key={award.id}
                className={`flex items-center gap-3 px-4 py-3 ${soft ? "rounded-full" : dark ? "rounded-[10px]" : "border-2"}`}
                style={{
                  background: highlighted ? preset.accent : preset.card,
                  border: `${soft || dark ? 1 : 2}px solid ${highlighted ? preset.accent : preset.border}`,
                  color: highlighted ? "#ffffff" : preset.text,
                }}
              >
                <span className="text-xl leading-none" aria-hidden="true">{award.emoji}</span>
                <div className="min-w-0">
                  <div className={`text-[13px] font-extrabold leading-tight ${soft ? "normal-case" : "uppercase"}`}>
                    {award.label}
                  </div>
                  <div className="text-[11px] font-semibold leading-snug opacity-65">
                    <span className="font-bold">{award.who}</span>
                    {" — "}{awardLines.get(award.id)}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {content.highlights.length > 0 ? (
          <>
            <ReportSectionLabel color={preset.muted}>{preset.momentsLabel}</ReportSectionLabel>
            <section
              className={`flex flex-col gap-4 p-4 ${soft ? "rounded-[18px] shadow-sweetheart" : dark ? "rounded-[10px]" : "border-2"}`}
              style={{
                background: preset.card,
                border: `${soft || dark ? 1 : 2}px solid ${preset.border}`,
              }}
              aria-label="Chat highlights"
            >
              {content.highlights.map((highlight, index) => (
                <div
                  key={`${highlight.label}-${index}`}
                  className={index === 0 ? "" : "border-t pt-4"}
                  style={{ borderColor: preset.border }}
                >
                  <h2
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.06em]"
                    style={{ color: preset.muted }}
                  >
                    {highlight.label}
                  </h2>
                  {highlight.bubble ? (
                    <div
                      className={`mt-2 w-fit max-w-[88%] px-3.5 py-2.5 text-sm font-semibold leading-snug ${
                        soft
                          ? index % 2 === 0
                            ? "rounded-[16px_16px_16px_4px]"
                            : "ml-auto rounded-[16px_16px_4px_16px] text-white"
                          : "border-2"
                      }`}
                      style={{
                        background: index % 2 === 0 ? preset.accentSoft : preset.accent,
                        borderColor: preset.accent,
                        color: index % 2 === 0 && !dark ? preset.text : "#ffffff",
                      }}
                    >
                      {highlight.bubble}
                    </div>
                  ) : null}
                  <p className="mt-2.5 text-sm font-medium leading-relaxed" style={{ color: preset.muted }}>
                    {highlight.body}
                  </p>
                </div>
              ))}
            </section>
          </>
        ) : null}

        <ReportSectionLabel color={preset.accent}>{preset.storyLabel}</ReportSectionLabel>
        <section aria-labelledby="story-title">
          <h2 id="story-title" className="text-[30px] font-black leading-[0.98] tracking-[-1px]">
            {content.title}
          </h2>
          <p className="mt-4 whitespace-pre-line text-[15px] font-medium leading-[1.6]">{content.narrative}</p>
        </section>

        <ReportPdfDownload report={report} />
        <WrappedCard report={report} />

        <footer className="mt-8 border-t pt-4" style={{ borderColor: preset.border }}>
          <div className="flex items-end justify-between gap-4">
            <p
              className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em]"
              style={{ color: preset.muted }}
            >
              {formatLocalReportDate(stats.firstMessageDate.slice(0, 10))}
              {" — "}
              {formatLocalReportDate(stats.lastMessageDate.slice(0, 10))}
              <br />built from a locally parsed export
            </p>
            <div className="text-2xl font-black tracking-[-1px]">
              lores<span style={{ color: preset.accent }}>_</span>
            </div>
          </div>
        </footer>
        {dark ? <WarningTape accent={preset.accent} /> : null}
      </article>
    </main>
  );
}

function ReportSectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      className="mb-3 mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ color }}
    >
      {children}
    </div>
  );
}

function WarningTape({ accent }: { accent: string }) {
  return (
    <div
      aria-hidden="true"
      className="-mx-7 mb-6 h-3"
      style={{ background: `repeating-linear-gradient(135deg, ${accent} 0 14px, #090909 14px 28px)` }}
    />
  );
}
