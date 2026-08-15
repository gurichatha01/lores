import type { ReportMode } from "./types";

export type ReportTreatment = "soft" | "editorial" | "dark";
export type StatMetric =
  | "conversation-starts"
  | "reply-time"
  | "streak"
  | "late-night"
  | "message-share"
  | "laughs"
  | "last-of-day"
  | "media"
  | "busiest-day"
  | "word-count"
  | "silence"
  | "message-count"
  | "chat-span"
  | "busiest-hour"
  | "top-emoji"
  | "good-mornings"
  | "i-love-yous";

export interface ModePreset {
  id: ReportMode;
  label: string;
  emoji: string;
  note: string;
  descriptor: string;
  defaultSubtype: string;
  treatment: ReportTreatment;
  accent: string;
  accentSoft: string;
  surface: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  storyLabel: string;
  momentsLabel: string;
  statMetrics: readonly [StatMetric, StatMetric, StatMetric, StatMetric];
}

export const REPORT_MODES: readonly ReportMode[] = [
  "sweetheart",
  "ride-or-die",
  "group",
  "family",
  "work",
  "roast",
];

export const MODE_PRESETS: Record<ReportMode, ModePreset> = {
  sweetheart: {
    id: "sweetheart",
    label: "Sweetheart",
    emoji: "💕",
    note: "rose · for the one",
    descriptor: "for a partner or crush",
    defaultSubtype: "partner",
    treatment: "soft",
    accent: "#f0568a",
    accentSoft: "#fdeef4",
    surface: "#f5f2f0",
    card: "#ffffff",
    text: "#0a0a0a",
    muted: "rgba(10,10,10,.52)",
    border: "#f2dbe3",
    storyLabel: "your story, in full",
    momentsLabel: "the moments",
    statMetrics: ["conversation-starts", "reply-time", "streak", "late-night"],
  },
  "ride-or-die": {
    id: "ride-or-die",
    label: "Ride or Die",
    emoji: "👯",
    note: "hot-orange · best-friend energy",
    descriptor: "for your best friend",
    defaultSubtype: "best friends",
    treatment: "editorial",
    accent: "#ff5c1a",
    accentSoft: "#ffe4d8",
    surface: "#f3f3ef",
    card: "#ffffff",
    text: "#0a0a0a",
    muted: "rgba(10,10,10,.55)",
    border: "#0a0a0a",
    storyLabel: "the friendship lores",
    momentsLabel: "the evidence",
    statMetrics: ["message-share", "reply-time", "laughs", "late-night"],
  },
  group: {
    id: "group",
    label: "Group Wrapped",
    emoji: "🏆",
    note: "cobalt · scoreboard",
    descriptor: "for the group chat",
    defaultSubtype: "group chat",
    treatment: "editorial",
    accent: "#2b2bef",
    accentSoft: "#e5e5ff",
    surface: "#f3f3ef",
    card: "#ffffff",
    text: "#0a0a0a",
    muted: "rgba(10,10,10,.55)",
    border: "#0a0a0a",
    storyLabel: "the group lores",
    momentsLabel: "the leaderboard",
    statMetrics: ["message-share", "conversation-starts", "laughs", "last-of-day"],
  },
  family: {
    id: "family",
    label: "Family",
    emoji: "🏡",
    note: "cozy amber  ·  warm",
    descriptor: "for the family",
    defaultSubtype: "family",
    treatment: "soft",
    accent: "#e8940c",
    accentSoft: "#fff0cd",
    surface: "#fff8eb",
    card: "#ffffff",
    text: "#0a0a0a",
    muted: "rgba(10,10,10,.52)",
    border: "#f0d9ad",
    storyLabel: "the family story",
    momentsLabel: "the keepsakes",
    statMetrics: ["conversation-starts", "reply-time", "media", "last-of-day"],
  },
  work: {
    id: "work",
    label: "Work",
    emoji: "💼",
    note: "cool teal · office edition",
    descriptor: "for the team",
    defaultSubtype: "team",
    treatment: "editorial",
    accent: "#0f8f8f",
    accentSoft: "#dff3f0",
    surface: "#eef6f5",
    card: "#ffffff",
    text: "#0a0a0a",
    muted: "rgba(10,10,10,.55)",
    border: "#0a0a0a",
    storyLabel: "the office lores",
    momentsLabel: "meeting notes",
    statMetrics: ["word-count", "reply-time", "busiest-day", "conversation-starts"],
  },
  roast: {
    id: "roast",
    label: "Roast 🔥",
    emoji: "🔥",
    note: "red heat · dark",
    descriptor: "no mercy",
    defaultSubtype: "no mercy",
    treatment: "dark",
    accent: "#e11400",
    accentSoft: "#3a120d",
    surface: "#120a08",
    card: "#1c1110",
    text: "#f3f3ef",
    muted: "rgba(243,243,239,.6)",
    border: "#4b211b",
    storyLabel: "the verdict",
    momentsLabel: "the allegations",
    statMetrics: ["reply-time", "message-share", "late-night", "silence"],
  },
};

export function isReportMode(value: unknown): value is ReportMode {
  return typeof value === "string" && REPORT_MODES.includes(value as ReportMode);
}

export function getModePreset(mode: ReportMode): ModePreset {
  return MODE_PRESETS[mode];
}

/**
 * The edition label with any decorative trailing emoji stripped (e.g.
 * "Roast 🔥" -> "Roast"), for icon-led surfaces like the /create flow and the
 * landing edition cards where the emoji would double up with the Lucide icon.
 */
export function plainModeLabel(mode: ReportMode): string {
  return MODE_PRESETS[mode].label.replace(/\s*\p{Extended_Pictographic}+$/u, "").trimEnd();
}
