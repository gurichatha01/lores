import type { ReportMode } from "./types";

export type ExportPlatform = "ios" | "android";

export const PARTNER_SUBTYPES = [
  "situationship",
  "gf",
  "bf",
  "crush",
  "ex",
] as const;

export const EXPORT_INSTRUCTIONS: Record<
  ExportPlatform,
  { label: string; eyebrow: string; steps: readonly string[]; result: string }
> = {
  ios: {
    label: "iPhone",
    eyebrow: "WhatsApp on iOS",
    steps: [
      "Open the chat and tap the name at the top.",
      "Scroll down and tap Export Chat.",
      "Choose Without Media, then save or share the ZIP.",
    ],
    result: "You’ll upload the .zip file on the next screen.",
  },
  android: {
    label: "Android",
    eyebrow: "WhatsApp on Android",
    steps: [
      "Open the chat and tap ⋮ in the top-right.",
      "Tap More, then Export chat.",
      "Choose Without media, then save or share the TXT/ZIP.",
    ],
    result: "You’ll upload the .txt or .zip file on the next screen.",
  },
};

export function defaultSubtypeForMode(mode: ReportMode): string {
  return mode === "sweetheart" ? PARTNER_SUBTYPES[0] : "";
}

export function narrativeFirstLine(narrative: string): string {
  const compact = narrative.replace(/\s+/gu, " ").trim();
  if (!compact) return "";
  const sentence = compact.match(/^.*?[.!?](?=\s|$)/u)?.[0];
  return sentence ?? compact;
}
