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

const BACKDROP_VARS = (accent: string, accentSoft: string, background: string): CSSProperties =>
  ({
    "--report-accent": accent,
    "--report-accent-soft": accentSoft,
    "--report-backdrop": background,
    "--rail-w": "clamp(300px, 36vw, 460px)",
    backgroundColor: background,
  }) as CSSProperties;

export function ReportBackdrop({
  accent,
  accentSoft,
  background,
  children,
  centered = false,
  railMode,
}: ReportBackdropProps) {
  // With a rail, lay the page out as [sticky rail | report column]. The rail is
  // sticky (not viewport-fixed) so it's bounded by this main's height and
  // scrolls away before any following footer instead of bleeding over it, while
  // still reading as a pinned full-height panel throughout the report.
  if (railMode) {
    return (
      <main
        className="report-desktop-backdrop min-h-screen lg:flex lg:items-stretch"
        style={BACKDROP_VARS(accent, accentSoft, background)}
      >
        <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:w-[var(--rail-w)] lg:shrink-0 lg:self-start">
          <BrandRail mode={railMode} className="flex h-full" />
        </div>
        <div className="min-w-0 flex-1 px-0 py-0 sm:px-6 sm:py-10 lg:px-12 lg:py-16 xl:px-16 xl:py-20">
          {children}
        </div>
      </main>
    );
  }

  return (
    <main
      className={`report-desktop-backdrop min-h-screen ${
        centered
          ? "flex items-center justify-center px-6 py-12 lg:px-12 lg:py-16 xl:px-16 xl:py-20"
          : "px-0 py-0 sm:px-6 sm:py-10 lg:px-12 lg:py-16 xl:px-16 xl:py-20"
      }`}
      style={BACKDROP_VARS(accent, accentSoft, background)}
    >
      {children}
    </main>
  );
}
