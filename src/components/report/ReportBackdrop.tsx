import type { CSSProperties, ReactNode } from "react";

interface ReportBackdropProps {
  accent: string;
  accentSoft: string;
  background: string;
  children: ReactNode;
  centered?: boolean;
}

export function ReportBackdrop({
  accent,
  accentSoft,
  background,
  children,
  centered = false,
}: ReportBackdropProps) {
  return (
    <main
      className={`report-desktop-backdrop min-h-screen ${
        centered
          ? "flex items-center justify-center px-6 py-12 lg:px-12 lg:py-16 xl:px-16 xl:py-20"
          : "px-0 py-0 sm:px-6 sm:py-10 lg:px-12 lg:py-16 xl:px-16 xl:py-20"
      }`}
      style={
        {
          "--report-accent": accent,
          "--report-accent-soft": accentSoft,
          "--report-backdrop": background,
          backgroundColor: background,
        } as CSSProperties
      }
    >
      {children}
    </main>
  );
}
