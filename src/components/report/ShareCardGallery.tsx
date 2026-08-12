"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getModePreset } from "@/lib/modePresets";
import { buildShareCards, type ShareCardContent } from "@/lib/shareCards";
import type { ReportSessionData } from "@/lib/types";

interface ShareCardGalleryProps {
  report: ReportSessionData;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

export function ShareCardGallery({ report }: ShareCardGalleryProps) {
  const cards = useMemo(() => buildShareCards(report), [report]);

  return (
    <section className="mt-8 border-t pt-6" style={{ borderColor: getModePreset(report.mode).border }}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] opacity-50">share cards · 9:16</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-1px]">take the lore with you.</h2>
        </div>
        <span className="font-mono text-[9px] uppercase opacity-40">PNG · 1080×1920</span>
      </div>
      <div className="-mx-6 mt-4 flex snap-x gap-3 overflow-x-auto px-6 pb-3 sm:-mx-7 sm:px-7">
        {cards.map((card) => (
          <ShareCardPreview key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

function ShareCardPreview({ card }: { card: ShareCardContent }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render(): Promise<void> {
      await document.fonts?.ready;
      if (cancelled || !canvasRef.current) return;
      drawShareCard(canvasRef.current, card);
      setReady(true);
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [card]);

  async function download(): Promise<void> {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = card.fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setDownloaded(true);
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  return (
    <figure className="w-[270px] flex-none snap-center">
      <canvas
        ref={canvasRef}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        className="aspect-[9/16] w-full rounded-[20px] bg-share-dark shadow-editorial"
        aria-label={`${card.eyebrow}: ${card.headline}`}
      />
      <button
        type="button"
        disabled={!ready}
        onClick={download}
        className="mt-2 min-h-11 w-full border-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors hover:bg-ink hover:text-white disabled:opacity-40"
        style={{ borderColor: "currentColor" }}
      >
        {downloaded ? "downloaded ✓" : `download ${card.kind} ↓`}
      </button>
    </figure>
  );
}

function drawShareCard(canvas: HTMLCanvasElement, card: ShareCardContent): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const preset = getModePreset(card.mode);
  const background = card.mode === "roast" ? "#120a08" : "#0b0b0c";
  const foreground = "#f3f3ef";
  const muted = "rgba(243,243,239,.55)";

  context.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  context.fillStyle = background;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const glow = context.createRadialGradient(540, card.kind === "award" ? 1020 : 240, 40, 540, 700, 920);
  glow.addColorStop(0, `${preset.accent}55`);
  glow.addColorStop(1, "transparent");
  context.fillStyle = glow;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  if (card.mode === "roast") {
    drawWarningTape(context, 0);
    drawWarningTape(context, CARD_HEIGHT - 68);
  }

  context.textBaseline = "top";
  context.fillStyle = preset.accent;
  context.font = "700 34px 'Space Mono', monospace";
  context.letterSpacing = "5px";
  context.fillText(`${preset.emoji} ${card.eyebrow.toUpperCase()}`, 86, 96);
  context.letterSpacing = "0px";

  if (card.kind === "hero") {
    context.fillStyle = muted;
    context.font = "700 31px 'Space Mono', monospace";
    context.fillText("TOTAL MESSAGES", 86, 650);
    context.fillStyle = preset.accent;
    context.font = "900 226px Archivo, Arial, sans-serif";
    context.fillText(card.headline, 76, 700);
    context.fillStyle = foreground;
    context.font = "600 58px Archivo, Arial, sans-serif";
    drawWrappedText(context, card.body, 86, 990, 900, 76, 6);
  } else if (card.kind === "award") {
    context.textAlign = "center";
    context.fillStyle = foreground;
    context.font = "190px Arial, sans-serif";
    context.fillText(card.emoji ?? "🏆", 540, 470);
    context.font = "900 112px Archivo, Arial, sans-serif";
    drawWrappedText(context, card.headline.toUpperCase(), 540, 700, 880, 106, 3, true);
    context.fillStyle = "rgba(243,243,239,.78)";
    context.font = "600 46px Archivo, Arial, sans-serif";
    drawWrappedText(context, card.body, 540, 1040, 850, 64, 5, true);
    context.textAlign = "left";
  } else {
    context.fillStyle = foreground;
    context.font = "900 100px Archivo, Arial, sans-serif";
    const nextY = drawWrappedText(context, card.headline, 86, 500, 900, 102, 7);
    context.fillStyle = "rgba(243,243,239,.68)";
    context.font = "600 46px Archivo, Arial, sans-serif";
    drawWrappedText(context, card.body, 86, Math.min(nextY + 70, 1320), 880, 64, 4);
  }

  context.fillStyle = muted;
  context.font = "400 27px 'Space Mono', monospace";
  context.fillText("get yours →\nlore.app", 86, 1740);
  context.fillStyle = foreground;
  context.font = "900 70px Archivo, Arial, sans-serif";
  context.fillText("lore", 810, 1735);
  const logoWidth = context.measureText("lore").width;
  context.fillStyle = preset.accent;
  context.fillText("_", 810 + logoWidth, 1735);
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

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  centered = false,
): number {
  const words = text.replace(/\s+/gu, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.join(" ").length < text.trim().length && lines.length > 0) {
    lines[lines.length - 1] = `${lines.at(-1)!.replace(/[.,;:!?]?$/u, "")}…`;
  }

  context.textAlign = centered ? "center" : "left";
  lines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}
