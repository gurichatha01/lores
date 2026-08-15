import type { CSSProperties, ReactNode } from "react";

import { BrandRail } from "@/components/BrandRail";
import type { ReportMode } from "@/lib/types";

interface ReportBackdropProps {
  accent: string;
  accentSoft: string;
  background: string;
  children: ReactNode;
  centered?: boolean;
  /**
   * When set, renders the shared brand rail down the left on desktop (the same
   * panel as the /create flow) and insets the report column to clear it, so the
   * left pane persists from /create all the way through to the report.
   */
  railMode?: ReportMode;
}

/** Horizontal padding that clears the fixed rail on desktop and keeps a gutter
 *  on both sides of the report column. Kept in sync with the fixed unlock bar's
 *  `lg:left-[var(--rail-w)]` offset in LockedReport so the two stay aligned. */
const RAIL_PADDING =
  "lg:pl-[calc(var(--rail-w)+clamp(1.5rem,4vw,4rem))] lg:pr-[clamp(1.5rem,4vw,4rem)] lg:py-16 xl:py-20";
const PLAIN_PADDING = "lg:px-12 lg:py-16 xl:px-16 xl:py-20";

export function ReportBackdrop({
  accent,
  accentSoft,
  background,
  children,
  centered = false,
  railMode,
}: ReportBackdropProps) {
  const desktopPadding = railMode ? RAIL_PADDING : PLAIN_PADDING;

  return (
    <main
      className={`report-desktop-backdrop min-h-screen ${
        centered
          ? `flex items-center justify-center px-6 py-12 ${desktopPadding}`
          : `px-0 py-0 sm:px-6 sm:py-10 ${desktopPadding}`
      }`}
      style={
        {
          "--report-accent": accent,
          "--report-accent-soft": accentSoft,
          "--report-backdrop": background,
          "--rail-w": "clamp(300px, 36vw, 460px)",
          backgroundColor: background,
        } as CSSProperties
      }
    >
      {railMode ? (
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:block lg:w-[var(--rail-w)]">
          <BrandRail mode={railMode} className="flex h-full" />
        </div>
      ) : null}
      {children}
    </main>
  );
}
