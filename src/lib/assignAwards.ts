import type { Award, ChatStats, PersonStats } from "./types";

interface AwardDefinition {
  id: string;
  label: string;
  emoji: string;
  score: (person: PersonStats) => number;
  eligible?: (person: PersonStats) => boolean;
  direction?: "max" | "min";
}

const AWARDS: readonly AwardDefinition[] = [
  {
    id: "certified-ghost",
    label: "Certified Ghost",
    emoji: "👻",
    score: (person) => person.medianReplyTimeMin,
  },
  {
    id: "main-character",
    label: "Main Character",
    emoji: "🎭",
    score: (person) => person.messageShare,
  },
  {
    id: "3am-overthinker",
    label: "3AM Overthinker",
    emoji: "🌙",
    score: (person) => person.lateNightCount,
  },
  {
    id: "one-word-warrior",
    label: "One-Word Warrior",
    emoji: "🗿",
    score: (person) => person.avgWordsPerMessage,
    eligible: (person) => person.messageCount > 0,
    direction: "min",
  },
  {
    id: "comedian",
    label: "Comedian",
    emoji: "🎤",
    score: (person) => person.laughCount,
  },
  {
    id: "the-initiator",
    label: "The Initiator",
    emoji: "🚀",
    score: (person) => person.conversationStarts,
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
      },
    ];
  });
}
