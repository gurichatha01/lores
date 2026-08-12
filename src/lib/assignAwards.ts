import type { Award, ChatStats, PersonStats } from "./types";

interface AwardDefinition {
  id: string;
  label: string;
  emoji: string;
  score: (person: PersonStats) => number;
  eligible?: (person: PersonStats) => boolean;
  direction?: "max" | "min";
  detail: (person: PersonStats) => string;
}

const AWARDS: readonly AwardDefinition[] = [
  {
    id: "certified-ghost",
    label: "Certified Ghost",
    emoji: "👻",
    score: (person) => person.medianReplyTimeMin,
    detail: (person) => `median reply ${formatMinutes(person.medianReplyTimeMin)}`,
  },
  {
    id: "main-character",
    label: "Main Character",
    emoji: "🎭",
    score: (person) => person.messageShare,
    detail: (person) => `${Math.round(person.messageShare * 100)}% of all messages`,
  },
  {
    id: "3am-overthinker",
    label: "3AM Overthinker",
    emoji: "🌙",
    score: (person) => person.lateNightCount,
    detail: (person) => `${formatCount(person.lateNightCount)} late-night messages`,
  },
  {
    id: "one-word-warrior",
    label: "One-Word Warrior",
    emoji: "🗿",
    score: (person) => person.avgWordsPerMessage,
    eligible: (person) => person.messageCount > 0,
    direction: "min",
    detail: (person) => {
      const average = formatDecimal(person.avgWordsPerMessage);
      return `${average} ${average === "1" ? "word" : "words"} per message`;
    },
  },
  {
    id: "comedian",
    label: "Comedian",
    emoji: "🎤",
    score: (person) => person.laughCount,
    detail: (person) => `${formatCount(person.laughCount)} laugh-messages`,
  },
  {
    id: "the-initiator",
    label: "The Initiator",
    emoji: "🚀",
    score: (person) => person.conversationStarts,
    detail: (person) => `${formatCount(person.conversationStarts)} conversation starts`,
  },
];

/** Award winners are selected only from deterministic person metrics. */
export function assignAwards(stats: ChatStats): Award[] {
  if (stats.people.length === 0) {
    return [];
  }

  return AWARDS.flatMap((definition) => {
    const candidates = stats.people.filter((person) => definition.eligible?.(person) ?? true);
    if (candidates.length === 0) {
      return [];
    }

    const winner = candidates.reduce((best, candidate) => {
      const bestScore = definition.score(best);
      const candidateScore = definition.score(candidate);
      const candidateWins =
        definition.direction === "min"
          ? candidateScore < bestScore
          : candidateScore > bestScore;
      return candidateWins ? candidate : best;
    });

    return [
      {
        id: definition.id,
        label: definition.label,
        emoji: definition.emoji,
        who: winner.name,
        detail: definition.detail(winner),
      },
    ];
  });
}

function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatDecimal(value: number): string {
  return Number(value.toFixed(1)).toLocaleString("en-US", { maximumFractionDigits: 1 });
}
