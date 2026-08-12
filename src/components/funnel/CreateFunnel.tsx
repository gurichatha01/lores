"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { assignAwards } from "@/lib/assignAwards";
import { computeStats } from "@/lib/computeStats";
import { curateSample } from "@/lib/curateSample";
import {
  defaultSubtypeForMode,
  EXPORT_INSTRUCTIONS,
  type ExportPlatform,
  PARTNER_SUBTYPES,
} from "@/lib/funnel";
import { getModePreset, REPORT_MODES } from "@/lib/modePresets";
import { parseWhatsApp } from "@/lib/parseWhatsApp";
import { createReportSession, REPORT_SESSION_KEY } from "@/lib/reportSession";
import { serializeGenerateReportInput } from "@/lib/reportTransport";
import { parseReportContent } from "@/lib/reportValidation";
import type { ReportMode } from "@/lib/types";

type FunnelStep = "mode" | "context" | "source" | "instructions" | "upload";
type GenerationStage = "idle" | "reading" | "generating";

const STEP_NUMBER: Record<FunnelStep, number> = {
  mode: 1,
  context: 2,
  source: 3,
  instructions: 4,
  upload: 5,
};

const PREVIOUS_STEP: Partial<Record<FunnelStep, FunnelStep>> = {
  context: "mode",
  source: "context",
  instructions: "source",
  upload: "instructions",
};

export function CreateFunnel() {
  const router = useRouter();
  const [step, setStep] = useState<FunnelStep>("mode");
  const [mode, setMode] = useState<ReportMode>("sweetheart");
  const [subtype, setSubtype] = useState<string>(PARTNER_SUBTYPES[0]);
  const [userContext, setUserContext] = useState("");
  const [platform, setPlatform] = useState<ExportPlatform>("ios");
  const [file, setFile] = useState<File | null>(null);
  const [generationStage, setGenerationStage] = useState<GenerationStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const preset = getModePreset(mode);
  const busy = generationStage !== "idle";

  function chooseMode(nextMode: ReportMode): void {
    setMode(nextMode);
    setSubtype(defaultSubtypeForMode(nextMode) || getModePreset(nextMode).defaultSubtype);
  }

  function goBack(): void {
    const previous = PREVIOUS_STEP[step];
    if (previous) setStep(previous);
  }

  async function generate(): Promise<void> {
    if (!file || busy) return;
    setError(null);
    setGenerationStage("reading");

    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const parsed = await parseWhatsApp(file);
      const stats = computeStats(parsed);
      const awards = assignAwards(stats);
      const sample = curateSample(parsed.messages);
      const input = serializeGenerateReportInput({
        mode,
        subtype,
        userContext: userContext.trim(),
        stats,
        awards,
        sample,
      });

      setGenerationStage("generating");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const responseText = await response.text();
      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = null;
      }
      if (!response.ok) {
        const detail =
          responseBody &&
          typeof responseBody === "object" &&
          typeof (responseBody as { error?: unknown }).error === "string"
            ? (responseBody as { error: string }).error
            : "The report writer could not finish this one. Your file is still here — please try again.";
        throw new Error(detail);
      }

      const content = parseReportContent(responseBody);
      window.sessionStorage.setItem(REPORT_SESSION_KEY, JSON.stringify(createReportSession(input, content)));
      router.push("/report");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong while generating the report.");
      setGenerationStage("idle");
    }
  }

  if (busy) {
    return <GeneratingScreen mode={mode} stage={generationStage} />;
  }

  return (
    <main className="min-h-screen bg-[#dcdcd7] px-0 py-0 sm:px-6 sm:py-10">
      <section
        className={`mx-auto flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden px-6 pb-8 pt-6 shadow-editorial sm:min-h-[760px] sm:px-8 sm:pb-10 sm:pt-8 ${
          preset.treatment === "soft" ? "sm:rounded-[44px]" : "sm:rounded-[8px]"
        }`}
        style={{ background: "#f3f3ef", color: "#0a0a0a" }}
        data-funnel-step={step}
      >
        <header className="flex items-center justify-between border-b-2 pb-3" style={{ borderColor: preset.text }}>
          <Link href="/" className="text-2xl font-black tracking-[-1px]">
            lores<span style={{ color: preset.accent }}>_</span>
          </Link>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: preset.accent }}>
            {String(STEP_NUMBER[step]).padStart(2, "0")} / 05
          </span>
        </header>

        <div className="flex-1">
          {step === "mode" ? (
            <ModeStep mode={mode} subtype={subtype} onMode={chooseMode} onSubtype={setSubtype} />
          ) : null}
          {step === "context" ? (
            <ContextStep value={userContext} onChange={setUserContext} />
          ) : null}
          {step === "source" ? <SourceStep /> : null}
          {step === "instructions" ? (
            <InstructionsStep platform={platform} onPlatform={setPlatform} />
          ) : null}
          {step === "upload" ? (
            <UploadStep file={file} error={error} onFile={(nextFile) => { setFile(nextFile); setError(null); }} />
          ) : null}
        </div>

        <div className="mt-8">
          {step === "mode" ? (
            <FunnelButton accent={preset.accent} onClick={() => setStep("context")}>
              next · add context →
            </FunnelButton>
          ) : null}
          {step === "context" ? (
            <FunnelButton accent={preset.accent} onClick={() => setStep("source")}>
              {userContext.trim() ? "save context →" : "skip for now →"}
            </FunnelButton>
          ) : null}
          {step === "source" ? (
            <FunnelButton accent={preset.accent} onClick={() => setStep("instructions")}>
              show me how to export →
            </FunnelButton>
          ) : null}
          {step === "instructions" ? (
            <FunnelButton accent={preset.accent} onClick={() => setStep("upload")}>
              I’ve got the export →
            </FunnelButton>
          ) : null}
          {step === "upload" ? (
            <FunnelButton accent={preset.accent} disabled={!file} onClick={generate}>
              make my {preset.label.toLowerCase()} lores →
            </FunnelButton>
          ) : null}
          {step !== "mode" ? (
            <button type="button" onClick={goBack} className="mt-4 w-full font-mono text-[10px] font-bold uppercase tracking-[0.1em] opacity-45">
              ← back
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function StepIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mt-9">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">{eyebrow}</p>
      <h1 className="mt-3 text-[42px] font-black leading-[0.92] tracking-[-2px]">{title}</h1>
      <p className="mt-4 text-[14px] font-medium leading-relaxed text-ink/55">{body}</p>
    </div>
  );
}

function ModeStep({ mode, subtype, onMode, onSubtype }: { mode: ReportMode; subtype: string; onMode: (mode: ReportMode) => void; onSubtype: (subtype: string) => void }) {
  return (
    <>
      <StepIntro
        eyebrow="first, set the relationship"
        title="who’s this chat with?"
        body="Pick the edition that should shape the report. The numbers stay exact; only the framing changes."
      />
      <div className="mt-6 grid grid-cols-2 gap-2" aria-label="Report mode">
        {REPORT_MODES.map((modeId) => {
          const option = getModePreset(modeId);
          const selected = modeId === mode;
          return (
            <button
              key={modeId}
              type="button"
              aria-pressed={selected}
              onClick={() => onMode(modeId)}
              className="min-h-[74px] border-2 px-3 py-2.5 text-left transition-transform active:translate-y-px"
              style={{ background: selected ? option.accent : option.card, borderColor: selected ? option.accent : option.text, color: selected ? "#fff" : option.text }}
            >
              <span className="block text-base" aria-hidden="true">{option.emoji}</span>
              <span className="mt-1 block text-[12px] font-extrabold leading-tight">{option.label}</span>
            </button>
          );
        })}
      </div>
      {mode === "sweetheart" ? (
        <fieldset className="mt-6">
          <legend className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink/45">partner sub-type</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PARTNER_SUBTYPES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === subtype}
                onClick={() => onSubtype(option)}
                className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
                style={{ background: option === subtype ? "#ff2d78" : "#fff", borderColor: "#0a0a0a", color: option === subtype ? "#fff" : "#0a0a0a" }}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
    </>
  );
}

function ContextStep({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <>
      <StepIntro eyebrow="optional · give the writer a clue" title="anything we should know?" body="A little context can help the writing land. Leave this blank if the chat should speak for itself." />
      <label htmlFor="chat-context" className="mt-7 block font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink/45">context for this report</label>
      <textarea
        id="chat-context"
        value={value}
        maxLength={500}
        rows={7}
        onChange={(event) => onChange(event.target.value)}
        placeholder="e.g. We met at uni, this is for our anniversary, and the ‘blue mug’ thing is an inside joke."
        className="mt-2 w-full resize-none border-2 border-ink bg-white p-4 text-sm font-medium leading-relaxed outline-none placeholder:text-ink/30 focus:shadow-[5px_5px_0_#ccff00]"
      />
      <p className="mt-2 text-right font-mono text-[9px] text-ink/35">{value.length} / 500</p>
    </>
  );
}

function SourceStep() {
  return (
    <>
      <StepIntro eyebrow="source · one place for now" title="where’s the chat?" body="lores currently reads WhatsApp exports. You’ll make the export yourself, then bring the file back here." />
      <div className="mt-8 border-2 border-ink bg-white p-5 shadow-[7px_7px_0_#25d366]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-[#25d366] text-xl text-white" aria-hidden="true">◔</span>
            <div>
              <p className="text-xl font-black tracking-[-0.5px]">WhatsApp</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase text-ink/45">.zip or .txt export</p>
            </div>
          </div>
          <span className="bg-ink px-2 py-1 font-mono text-[9px] font-bold uppercase text-white">selected</span>
        </div>
      </div>
      <p className="mt-6 border-t-2 border-ink pt-4 font-mono text-[10px] leading-relaxed text-ink/45">No screenshots. No copy-pasting. The export keeps timestamps and senders intact so the engine can count accurately.</p>
    </>
  );
}

function InstructionsStep({ platform, onPlatform }: { platform: ExportPlatform; onPlatform: (platform: ExportPlatform) => void }) {
  const guide = EXPORT_INSTRUCTIONS[platform];
  return (
    <>
      <StepIntro eyebrow="about one minute · without media" title="export the chat." body="Choose your phone and follow these exact WhatsApp steps. Keep this page open while you do it." />
      <div className="mt-6 grid grid-cols-2 border-2 border-ink p-1" aria-label="Phone platform">
        {(Object.keys(EXPORT_INSTRUCTIONS) as ExportPlatform[]).map((option) => (
          <button key={option} type="button" aria-pressed={option === platform} onClick={() => onPlatform(option)} className={`min-h-11 text-[12px] font-extrabold ${option === platform ? "bg-ink text-white" : "bg-transparent text-ink"}`}>
            {option === "ios" ? "iOS · " : ""}{EXPORT_INSTRUCTIONS[option].label}
          </button>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-[92px_1fr] gap-4">
        <PhoneGuide platform={platform} />
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink/45">{guide.eyebrow}</p>
          <ol className="mt-3 space-y-3">
            {guide.steps.map((instruction, index) => (
              <li key={instruction} className="grid grid-cols-[26px_1fr] gap-2 text-[13px] font-semibold leading-snug">
                <span className="grid size-6 place-items-center bg-ink font-mono text-[10px] text-white">{index + 1}</span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="mt-5 border-2 border-ink bg-acid p-3 font-mono text-[10px] font-bold leading-relaxed">Choose WITHOUT MEDIA. lores still counts omitted media markers, and the export stays small.</div>
      <p className="mt-3 text-[11px] font-semibold text-ink/50">{guide.result}</p>
    </>
  );
}

function PhoneGuide({ platform }: { platform: ExportPlatform }) {
  return (
    <div className="rounded-[18px] border-2 border-ink bg-white p-2 shadow-[4px_4px_0_#cfcfc8]" aria-hidden="true">
      <div className="mx-auto h-1.5 w-8 rounded-full bg-ink/20" />
      <div className="mt-3 flex items-center justify-between border-b border-hairline pb-2 text-[7px] font-bold"><span>‹ CHAT</span><span>{platform === "ios" ? "NAME" : "⋮"}</span></div>
      <div className="mt-3 space-y-2">
        <div className="h-5 w-[85%] rounded-[8px_8px_8px_2px] bg-[#e9e9e4]" />
        <div className="ml-auto h-7 w-[72%] rounded-[8px_8px_2px_8px] bg-[#d8f8c6]" />
        <div className="h-4 w-[62%] rounded-[8px_8px_8px_2px] bg-[#e9e9e4]" />
      </div>
      <div className="mt-5 border-t border-hairline pt-2 text-center font-mono text-[6px] font-bold uppercase text-[#128c7e]">export chat</div>
    </div>
  );
}

function UploadStep({ file, error, onFile }: { file: File | null; error: string | null; onFile: (file: File | null) => void }) {
  return (
    <>
      <StepIntro eyebrow="last step · the file stays here" title="bring the chat back." body="Upload the WhatsApp export you just made. ZIP and TXT both work." />
      <label htmlFor="whatsapp-export" className="mt-7 block cursor-pointer border-2 border-dashed border-ink bg-white p-6 text-center transition-shadow hover:shadow-[7px_7px_0_#ccff00]">
        <span className="text-3xl" aria-hidden="true">↑</span>
        <span className="mt-3 block break-all text-lg font-black">{file ? file.name : "choose your export"}</span>
        <span className="mt-2 block font-mono text-[9px] uppercase tracking-[0.08em] text-ink/40">WhatsApp · .zip or .txt</span>
        <input id="whatsapp-export" type="file" accept=".zip,.txt,text/plain,application/zip" className="sr-only" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
      </label>
      <div className="mt-5 border-2 border-ink bg-acid p-4">
        <p className="text-sm font-black">🔒 privacy, in plain English</p>
        <p className="mt-2 text-[12px] font-semibold leading-relaxed text-ink/65">Your full chat is parsed in this browser. Media is never uploaded. Only aggregate stats, awards, and a small curated message sample go to the report writer.</p>
      </div>
      {error ? <div role="alert" className="mt-4 border-2 border-roast bg-white px-4 py-3 text-sm font-semibold text-roast">{error}</div> : null}
    </>
  );
}

function GeneratingScreen({ mode, stage }: { mode: ReportMode; stage: GenerationStage }) {
  const preset = getModePreset(mode);
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12" style={{ background: preset.surface, color: preset.text }}>
      <section className="w-full max-w-[430px] text-center" aria-live="polite">
        <div className="mx-auto grid size-24 place-items-center border-2 bg-white shadow-[8px_8px_0_var(--generating-accent)]" style={{ "--generating-accent": preset.accent, borderColor: preset.text } as React.CSSProperties}>
          <span className="lore-generating-mark text-5xl font-black" style={{ color: preset.accent }}>_</span>
        </div>
        <p className="mt-9 font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: preset.accent }}>{preset.emoji} {preset.label} edition</p>
        <h1 className="mt-3 text-[42px] font-black leading-[0.92] tracking-[-2px]">{stage === "reading" ? "counting everything." : "writing your lores."}</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm font-medium leading-relaxed" style={{ color: preset.muted }}>{stage === "reading" ? "Messages, streaks, replies, late nights, and every tiny pattern the chat forgot." : "The numbers are locked. The writer is turning them into a story now."}</p>
        <div className="mx-auto mt-8 max-w-xs border-y-2 py-3 font-mono text-[9px] uppercase leading-loose tracking-[0.08em]" style={{ borderColor: preset.text, color: preset.muted }}>parsed on this device<br />full chat never sent<br />please keep this tab open</div>
      </section>
    </main>
  );
}

function FunnelButton({ accent, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { accent: string }) {
  return (
    <button {...props} type="button" className="min-h-14 w-full px-5 text-[14px] font-extrabold uppercase tracking-[0.01em] text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35" style={{ background: accent }}>
      {children}
    </button>
  );
}
