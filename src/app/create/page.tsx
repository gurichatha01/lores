"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Chip } from "@/components/ui";
import { assignAwards } from "@/lib/assignAwards";
import { computeStats } from "@/lib/computeStats";
import { curateSample } from "@/lib/curateSample";
import { parseWhatsApp } from "@/lib/parseWhatsApp";
import { createReportSession, REPORT_SESSION_KEY } from "@/lib/reportSession";
import { serializeGenerateReportInput } from "@/lib/reportTransport";
import { parseReportContent } from "@/lib/reportValidation";

type Stage = "idle" | "reading" | "generating";

export default function CreateReportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = stage !== "idle";

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
        mode: "sweetheart",
        subtype: "partner",
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
    stage === "reading" ? "reading your chat…" : stage === "generating" ? "writing your lore…" : "generate my lore →";

  return (
    <main className="min-h-screen bg-[#dcdcd7] px-4 py-8 sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[36px] bg-[#f5f2f0] p-6 shadow-editorial sm:p-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-[-1px]">
            lore<span className="text-pink">_</span>
          </Link>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-sweetheart">
            private by design
          </span>
        </header>

        <div className="mt-10">
          <Chip className="border-sweetheart bg-white text-sweetheart">💕 sweetheart</Chip>
          <h1 className="mt-5 text-[46px] font-black leading-[0.92] tracking-[-2px]">
            turn a chat into your story.
          </h1>
          <p className="mt-4 text-[15px] font-medium leading-relaxed text-ink/65">
            Choose a WhatsApp export. Lore reads it here, computes the numbers, and sends only a small curated sample for the written report.
          </p>
        </div>

        <label
          htmlFor="whatsapp-export"
          className="mt-7 block cursor-pointer rounded-[18px] border border-dashed border-sweetheart bg-white p-5 shadow-sweetheart"
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink/45">
            WhatsApp export · .zip or .txt
          </span>
          <span className="mt-3 block break-all text-lg font-extrabold">
            {file ? file.name : "choose your exported chat →"}
          </span>
          <span className="mt-2 block text-xs font-semibold leading-relaxed text-ink/50">
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
          <div role="alert" className="mt-4 rounded-[14px] border border-sweetheart bg-[#fdeef4] px-4 py-3 text-sm font-semibold">
            {error}
          </div>
        ) : null}

        <Button
          variant="sweetheart"
          fullWidth
          className="mt-5"
          disabled={!file || busy}
          aria-busy={busy}
          onClick={generate}
        >
          {buttonLabel}
        </Button>

        <p className="mt-5 text-center font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em] text-ink/40">
          only derived stats, awards + 25 messages per person cross the network
        </p>
      </section>
    </main>
  );
}
