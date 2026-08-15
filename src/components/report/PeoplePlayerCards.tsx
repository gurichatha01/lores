"use client";

import { useLayoutEffect, useRef } from "react";

import { readableTextColor } from "@/lib/colorContrast";
import { getModePreset } from "@/lib/modePresets";
import { buildPlayerCards } from "@/lib/playerCards";
import type { ReportSessionData } from "@/lib/types";

interface PeoplePlayerCardsProps {
  report: ReportSessionData;
}

export function PeoplePlayerCards({ report }: PeoplePlayerCardsProps) {
  const preset = getModePreset(report.mode);
  const cards = buildPlayerCards(report);
  const headerText = readableTextColor(preset.accent);

  return (
    <section className="mt-6" aria-labelledby="people-title">
      <div
        id="people-title"
        className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: preset.muted }}
      >
        the people
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:gap-4">
        {cards.map((card) => (
          <article
            key={card.personName}
            className="min-w-0 overflow-hidden border-2 border-ink bg-white text-ink"
            aria-label={`${card.personName}, ${card.role}`}
          >
            <header
              className="relative min-h-[126px] overflow-hidden px-3 py-3.5 lg:min-h-[164px] lg:px-5 lg:py-5"
              style={{
                background: preset.accent,
                color: headerText,
              }}
            >
              {card.watermarkEmoji ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-3 -top-5 text-[82px] leading-none opacity-[0.14] lg:text-[116px]"
                >
                  {card.watermarkEmoji}
                </span>
              ) : null}

              <div className="relative font-mono text-[8px] font-bold uppercase tracking-[0.12em] opacity-75 lg:text-[10px]">
                {card.role}
              </div>

              <h3 className="relative mt-1.5 break-words text-[22px] font-black leading-[0.92] tracking-[-1px] lg:text-[30px]">
                {card.personName}
              </h3>

              <p className="relative mt-3 font-mono text-[8px] font-bold leading-snug opacity-80 lg:text-[10px]">
                {card.summary}
              </p>
            </header>

            <div className="flex min-h-[360px] flex-col gap-4 p-3 lg:min-h-[430px] lg:gap-5 lg:p-5">
              <div>
                <PlayerLabel>talks like</PlayerLabel>

                <p className="mt-1 text-[11px] font-bold leading-[1.5] lg:text-[14px]">
                  {card.signatureWords.map((word, index) => (
                    <span key={`${word}-${index}`}>
                      {index > 0 ? " · " : ""}
                      <span
                        style={
                          index === 0
                            ? { color: preset.accent }
                            : undefined
                        }
                      >
                        {word}
                      </span>
                    </span>
                  ))}
                </p>
              </div>

              <div className="grid min-h-[98px] grid-cols-3 border-2 border-ink lg:min-h-[122px]">
                {card.stats.map((stat, index) => (
                  <div
                    key={stat.id}
                    className={`min-w-0 overflow-hidden px-1.5 py-2.5 lg:px-3 lg:py-4 ${
                      index > 0 ? "border-l-2 border-ink" : ""
                    }`}
                  >
                    <AutoFitStatValue
                      value={String(stat.value)}
                      color={preset.accent}
                    />

                    <div className="mt-2 font-mono text-[7px] font-bold uppercase leading-tight tracking-[0.04em] text-ink/45 lg:text-[9px]">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 border-y border-ink/15 py-3">
                {card.secondary.map((item) => (
                  <div key={item.label} className="min-w-0">
                    <PlayerLabel>{item.label}</PlayerLabel>

                    <div className="mt-1 break-words text-[12px] font-extrabold leading-tight lg:text-[15px]">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-auto border-t-2 border-dashed border-ink/15 pt-3">
                <PlayerLabel>verdict</PlayerLabel>

                <p className="mt-1.5 text-[11px] font-semibold leading-[1.4] lg:text-[14px]">
                  {card.verdict}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

interface AutoFitStatValueProps {
  value: string;
  color: string;
}

function AutoFitStatValue({
  value,
  color,
}: AutoFitStatValueProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;

    if (!container || !text) return;

    const fitText = () => {
      /*
       * Desktop starts at 24px.
       * Mobile starts at 18px.
       * We then shrink ONLY if the value doesn't fit.
       */
      const desktop = window.matchMedia("(min-width: 1024px)").matches;

      const maxFontSize = desktop ? 24 : 18;
      const minFontSize = 9;

      text.style.fontSize = `${maxFontSize}px`;

      const availableWidth = container.clientWidth;

      if (availableWidth <= 0) return;

      /*
       * If it already fits, keep the normal/max font size.
       */
      if (text.scrollWidth <= availableWidth) {
        return;
      }

      /*
       * Binary-search for the largest font size
       * that fits inside the stat cell.
       */
      let low = minFontSize;
      let high = maxFontSize;
      let best = minFontSize;

      while (high - low > 0.25) {
        const mid = (low + high) / 2;

        text.style.fontSize = `${mid}px`;

        if (text.scrollWidth <= availableWidth) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      }

      /*
       * Tiny safety reduction so PDF/browser rounding
       * doesn't clip the last character.
       */
      text.style.fontSize = `${Math.max(minFontSize, best - 0.5)}px`;
    };

    fitText();

    const resizeObserver = new ResizeObserver(() => {
      fitText();
    });

    resizeObserver.observe(container);

    window.addEventListener("resize", fitText);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", fitText);
    };
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="w-full min-w-0 overflow-hidden"
    >
      <div
        ref={textRef}
        className="w-max max-w-none whitespace-nowrap font-black leading-none tracking-[-0.5px] tabular-nums"
        style={{
          color,
          fontSize: "18px",
        }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function PlayerLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-mono text-[7px] font-bold uppercase tracking-[0.12em] text-ink/45 lg:text-[9px]">
      {children}
    </div>
  );
}