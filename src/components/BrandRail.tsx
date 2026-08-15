import Link from "next/link";

import { BrandWordmark } from "@/components/BrandWordmark";
import { ModeIcon } from "@/components/ModeIcon";
import { getModePreset, plainModeLabel } from "@/lib/modePresets";
import type { ReportMode } from "@/lib/types";

interface BrandRailProps {
  mode: ReportMode;
  /** Positioning + responsive display are the caller's job (grid child on
   *  /create, fixed sidebar on the report). */
  className?: string;
}

/**
 * The accent-filled brand panel down the left of the journey — the /create
 * steps, the generating screen, and the report pages. One shared component so
 * the left pane is visually identical the whole way through. This owns the
 * fill, the flowing animation (.create-brand-panel), and the content; the
 * caller controls layout via className.
 */
export function BrandRail({ mode, className = "" }: BrandRailProps) {
  const preset = getModePreset(mode);
  const panelText = mode === "family" ? "#0a0a0a" : "#ffffff";

  return (
    <aside
      className={`create-brand-panel flex-col justify-between border-r-2 border-ink p-12 xl:p-16 ${className}`}
      style={{ background: preset.accent, color: panelText }}
      aria-label={`${preset.label} edition`}
    >
      <Link href="/" className="w-fit text-[54px] font-black leading-none tracking-[-4px]">
        <BrandWordmark accent={preset.accent} contrastPlate />
      </Link>
      <div className="max-w-[32rem]">
        <p className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
          <ModeIcon mode={mode} className="size-4" />
          {plainModeLabel(mode)} edition
        </p>
        <p className="mt-5 text-[clamp(3.25rem,5vw,5.8rem)] font-black leading-[0.84] tracking-[-5px]">
          the story hiding in your messages
        </p>
        <div className="mt-8 h-2 w-24" style={{ background: panelText }} aria-hidden="true" />
      </div>
      <p
        className="max-w-sm border-t-2 pt-4 font-mono text-[10px] font-bold uppercase leading-relaxed tracking-[0.12em] opacity-70"
        style={{ borderColor: panelText }}
      >
        chat stays on your device · counted exactly
      </p>
    </aside>
  );
}
