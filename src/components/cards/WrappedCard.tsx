"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getModePreset } from "@/lib/modePresets";
import { buildWrappedCard, type WrappedCardContent } from "@/lib/wrappedCard";
import type { ReportSessionData } from "@/lib/types";

interface WrappedCardProps {
  report: ReportSessionData;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const PADDING = 82;

export function WrappedCard({ report }: WrappedCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const content = useMemo(() => buildWrappedCard(report), [report]);
  const preset = getModePreset(report.mode);
  const [ready, setReady] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setDownloaded(false);

    async function render(): Promise<void> {
      await document.fonts?.ready;
      if (cancelled || !canvasRef.current) return;
      drawWrappedCard(canvasRef.current, content);
      setReady(true);
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [content]);

  async function download(): Promise<void> {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = content.fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setDownloaded(true);
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  return (
    <section className="mt-8 border-t pt-6" style={{ borderColor: preset.border }}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] opacity-50">
            your wrapped card · 9:16
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-1px]">one story. one card.</h2>
        </div>
        <span className="font-mono text-[9px] uppercase opacity-40">PNG · 1080×1920</span>
      </div>

      <figure className="mx-auto mt-4 w-full max-w-[326px]">
        <canvas
          ref={canvasRef}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          className="aspect-[9/16] w-full rounded-[20px] bg-share-dark shadow-editorial"
          aria-label={`${preset.label} Wrapped card for ${content.relationshipLine}`}
          data-share-surface="wrapped"
        />
        <button
          type="button"
          disabled={!ready}
          onClick={download}
          className="mt-3 min-h-12 w-full border-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors hover:bg-ink hover:text-white disabled:opacity-40"
          style={{ borderColor: "currentColor" }}
        >
          {downloaded ? "downloaded ✓" : "download wrapped card ↓"}
        </button>
      </figure>
    </section>
  );
}

function drawWrappedCard(canvas: HTMLCanvasElement, content: WrappedCardContent): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  const preset = getModePreset(content.mode);
  const background = content.mode === "roast" ? "#120a08" : "#0b0b0c";
  const foreground = "#f3f3ef";
  const muted = "rgba(243,243,239,.58)";
  const radius = preset.treatment === "soft" ? 32 : preset.treatment === "dark" ? 16 : 4;

  context.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  context.fillStyle = background;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const topGlow = context.createRadialGradient(540, 60, 20, 540, 280, 780);
  topGlow.addColorStop(0, `${preset.accent}66`);
  topGlow.addColorStop(1, "transparent");
  context.fillStyle = topGlow;
  context.fillRect(0, 0, CARD_WIDTH, 980);

  const bottomGlow = context.createRadialGradient(850, 1540, 20, 850, 1540, 620);
  bottomGlow.addColorStop(0, `${preset.accent}28`);
  bottomGlow.addColorStop(1, "transparent");
  context.fillStyle = bottomGlow;
  context.fillRect(0, 960, CARD_WIDTH, 960);

  if (content.mode === "roast") {
    drawWarningTape(context, 0);
    drawWarningTape(context, CARD_HEIGHT - 68);
  }

  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillStyle = preset.accent;
  context.font = "700 32px 'Space Mono', monospace";
  context.letterSpacing = "5px";
  context.fillText(`${content.modeEmoji} ${content.modeLabel.toUpperCase()} WRAPPED`, PADDING, 94);
  context.letterSpacing = "0px";

  context.fillStyle = foreground;
  context.font = "800 50px Archivo, Arial, sans-serif";
  drawWrappedText(context, content.relationshipLine, PADDING, 164, 916, 58, 2);

  context.strokeStyle = "rgba(243,243,239,.22)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(PADDING, 296);
  context.lineTo(CARD_WIDTH - PADDING, 296);
  context.stroke();

  context.fillStyle = muted;
  context.font = "700 27px 'Space Mono', monospace";
  context.letterSpacing = "3px";
  context.fillText(content.heroLabel.toUpperCase(), PADDING, 350);
  context.letterSpacing = "0px";
  context.fillStyle = preset.accent;
  fitAndDrawText(context, content.heroValue, PADDING - 6, 388, 928, 210, 118, 900);
  context.fillStyle = foreground;
  context.font = "700 48px Archivo, Arial, sans-serif";
  context.fillText(content.heroDetail, PADDING, 610);

  const tileWidth = 438;
  const tileHeight = 218;
  const tileGap = 40;
  const tileTop = 704;
  content.stats.forEach((stat, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PADDING + column * (tileWidth + tileGap);
    const y = tileTop + row * (tileHeight + 28);

    context.fillStyle = "rgba(255,255,255,.055)";
    fillRoundRect(context, x, y, tileWidth, tileHeight, radius);
    context.strokeStyle = `${preset.accent}88`;
    context.lineWidth = 2;
    strokeRoundRect(context, x, y, tileWidth, tileHeight, radius);

    context.fillStyle = muted;
    context.font = "700 23px 'Space Mono', monospace";
    context.letterSpacing = "2px";
    context.fillText(stat.label.toUpperCase(), x + 24, y + 24);
    context.letterSpacing = "0px";
    context.fillStyle = foreground;
    fitAndDrawText(context, stat.value, x + 24, y + 68, tileWidth - 48, 58, 31, 900);
    context.fillStyle = muted;
    fitAndDrawText(context, stat.detail, x + 24, y + 150, tileWidth - 48, 25, 19, 600);
  });

  const awardTop = 1230;
  context.fillStyle = muted;
  context.font = "700 25px 'Space Mono', monospace";
  context.letterSpacing = "3px";
  context.fillText("HEADLINE AWARD", PADDING, awardTop);
  context.letterSpacing = "0px";
  context.fillStyle = preset.accent;
  fillRoundRect(context, PADDING, awardTop + 48, 916, 176, radius);
  context.fillStyle = "#ffffff";
  context.font = "78px Arial, sans-serif";
  context.fillText(content.headlineAward.emoji, PADDING + 28, awardTop + 82);
  fitAndDrawText(
    context,
    content.headlineAward.label.toUpperCase(),
    PADDING + 132,
    awardTop + 73,
    742,
    62,
    36,
    900,
  );
  context.fillStyle = "rgba(255,255,255,.78)";
  fitAndDrawText(
    context,
    content.headlineAward.who,
    PADDING + 132,
    awardTop + 143,
    742,
    31,
    22,
    700,
  );

  context.fillStyle = preset.accent;
  context.font = "700 25px 'Space Mono', monospace";
  context.letterSpacing = "3px";
  context.fillText(content.mode === "roast" ? "THE VERDICT" : "THE LORES", PADDING, 1502);
  context.letterSpacing = "0px";
  context.fillStyle = foreground;
  context.font = "800 45px Archivo, Arial, sans-serif";
  drawWrappedText(context, `“${content.punchLine}”`, PADDING, 1548, 916, 54, 4);

  context.fillStyle = muted;
  context.font = "400 27px 'Space Mono', monospace";
  context.fillText(content.mode === "roast" ? "get roasted →\nlores.in" : "get yours →\nlores.in", PADDING, 1762);
  context.fillStyle = foreground;
  context.font = "900 70px Archivo, Arial, sans-serif";
  context.fillText("lores", 770, 1756);
  const logoWidth = context.measureText("lores").width;
  context.fillStyle = preset.accent;
  context.fillText("_", 770 + logoWidth, 1756);
}

function fitAndDrawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  weight: number,
): void {
  let size = maxSize;
  context.font = `${weight} ${size}px Archivo, Arial, sans-serif`;
  while (size > minSize && context.measureText(text).width > maxWidth) {
    size -= 2;
    context.font = `${weight} ${size}px Archivo, Arial, sans-serif`;
  }
  context.fillText(ellipsize(context, text, maxWidth), x, y);
}

function ellipsize(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && context.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value.trimEnd()}…`;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.replace(/\s+/gu, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  let consumed = 0;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
      consumed += 1;
    } else {
      lines.push(line);
      if (lines.length === maxLines) break;
      line = word;
      consumed += 1;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (consumed < words.length && lines.length > 0) {
    lines[lines.length - 1] = ellipsize(context, `${lines.at(-1)!}…`, maxWidth);
  }

  lines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function fillRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function strokeRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.stroke();
}

function drawWarningTape(context: CanvasRenderingContext2D, y: number): void {
  const stripeWidth = 70;
  for (let x = -CARD_HEIGHT; x < CARD_WIDTH + CARD_HEIGHT; x += stripeWidth) {
    context.save();
    context.translate(x, y);
    context.transform(1, 0, -1, 1, 0, 0);
    context.fillStyle = Math.floor(x / stripeWidth) % 2 === 0 ? "#e11400" : "#0a0a0a";
    context.fillRect(0, 0, stripeWidth, 68);
    context.restore();
  }
}
