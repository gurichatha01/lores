"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { assignAwards } from "@/lib/assignAwards";
import { computeStats } from "@/lib/computeStats";
import { curateSample } from "@/lib/curateSample";
import { getModePreset, REPORT_MODES } from "@/lib/modePresets";
import { parseWhatsApp } from "@/lib/parseWhatsApp";
import { createReportSession, REPORT_SESSION_KEY } from "@/lib/reportSession";
import { serializeGenerateReportInput } from "@/lib/reportTransport";
import { parseReportContent } from "@/lib/reportValidation";
import type { ReportMode } from "@/lib/types";

type Stage = "idle" | "reading" | "generating";

export default function CreateReportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ReportMode>("sweetheart");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = stage !== "idle";
  const preset = getModePreset(mode);

  async function generate(): Promise<void> {
    if (!file || busy) return;
    setError(null);
    setStage("reading");

    try {
      const parsed = await parseWhatsApp(file);
      const stats = computeStats(parsed);
      const awards = assignAwards(stats);
      const sample = curateSample(parsed.messages);
      const input = serializeGenerateReportInput({
        mode,
        subtype: preset.defaultSubtype,
        userContext: "",
        stats,
        awards,
        sample,
      });

      setStage("generating");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const responseBody: unknown = await response.json();
      if (!response.ok) {
        const detail =
          responseBody &&
          typeof responseBody === "object" &&
          typeof (responseBody as { error?: unknown }).error === "string"
            ? (responseBody as { error: string }).error
            : "Report generation failed.";
        throw new Error(detail);
      }

      const content = parseReportContent(responseBody);
      window.sessionStorage.setItem(
        REPORT_SESSION_KEY,
        JSON.stringify(createReportSession(input, content)),
      );
      router.push("/report");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong while generating the report.");
      setStage("idle");
    }
  }

  const buttonLabel =
    stage === "reading"
      ? "reading your chat…"
      : stage === "generating"
        ? `writing your ${preset.label.toLowerCase()} lore…`
        : `generate ${preset.label.toLowerCase()} lore →`;

  return (
    <main className="min-h-screen bg-[#dcdcd7] px-4 py-8 sm:px-6 sm:py-12">
      <section
        className={`mx-auto w-full max-w-[430px] overflow-hidden p-6 shadow-editorial sm:p-8 ${
          preset.treatment === "soft" ? "rounded-[36px]" : "rounded-[8px]"
        }`}
        style={{ background: preset.surface, color: preset.text }}
      >
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-[-1px]">
            lore<span className="text-pink">_</span>
          </Link>
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: preset.accent }}
          >
            private by design
          </span>
        </header>

        <div className="mt-10">
          <p
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: preset.accent }}
          >
            choose your edition
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Report mode">
            {REPORT_MODES.map((modeId) => {
              const option = getModePreset(modeId);
              const selected = modeId === mode;
              return (
                <button
                  key={modeId}
                  type="button"
                  aria-pressed={selected}
                  disabled={busy}
                  onClick={() => setMode(modeId)}
                  className={`min-h-12 border-2 px-3 text-left text-xs font-extrabold transition-transform active:translate-y-px ${
                    option.treatment === "soft" ? "rounded-full" : "rounded-[4px]"
                  }`}
                  style={{
                    background: selected ? option.accent : option.card,
                    borderColor: option.accent,
                    color: selected ? "#ffffff" : option.accent,
                  }}
                >
                  {option.emoji} {option.label}
                </button>
              );
            })}
          </div>
          <h1 className="mt-5 text-[46px] font-black leading-[0.92] tracking-[-2px]">
            turn a chat into your story.
          </h1>
          <p className="mt-4 text-[15px] font-medium leading-relaxed" style={{ color: preset.muted }}>
            Choose a WhatsApp export. Lore reads it here, computes the numbers, and sends only a small curated sample for the written report.
          </p>
        </div>

        <label
          htmlFor="whatsapp-export"
          className={`mt-7 block cursor-pointer border border-dashed p-5 ${
            preset.treatment === "soft" ? "rounded-[18px] shadow-sweetheart" : "rounded-[4px]"
          }`}
          style={{ background: preset.card, borderColor: preset.accent }}
        >
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: preset.muted }}
          >
            WhatsApp export · .zip or .txt
          </span>
          <span className="mt-3 block break-all text-lg font-extrabold">
            {file ? file.name : "choose your exported chat →"}
          </span>
          <span className="mt-2 block text-xs font-semibold leading-relaxed" style={{ color: preset.muted }}>
            Raw chat parsing stays in this browser. Media files are counted, never uploaded.
          </span>
          <input
            id="whatsapp-export"
            type="file"
            accept=".zip,.txt,text/plain,application/zip"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </label>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-[14px] border px-4 py-3 text-sm font-semibold"
            style={{ background: preset.accentSoft, borderColor: preset.accent }}
          >
            {error}
          </div>
        ) : null}

        <Button
          fullWidth
          className={`mt-5 ${preset.treatment === "soft" ? "rounded-full" : "rounded-[4px]"}`}
          style={{ background: preset.accent, borderColor: preset.accent, color: "#ffffff" }}
          disabled={!file || busy}
          aria-busy={busy}
          onClick={generate}
        >
          {buttonLabel}
        </Button>

        <p
          className="mt-5 text-center font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em]"
          style={{ color: preset.muted }}
        >
          only derived stats, awards + 25 messages per person cross the network
        </p>
      </section>
    </main>
  );
}
