import type { Award, ChatStats, PersonStats } from "./types";

interface AwardDefinition {
  id: string;
  label: string;
  emoji: string;
  score: (person: PersonStats) => number;
  eligible?: (person: PersonStats) => boolean;
  direction?: "max" | "min";
  detail: (person: PersonStats) => string;
  metric: string;
  selection: "highest" | "lowest";
  meaning: string;
  lineInstruction: string;
  lineMustMatch: RegExp;
  oppositeDirection?: RegExp;
}

export interface AwardMetricRule {
  metric: string;
  selection: "highest" | "lowest";
  meaning: string;
  lineInstruction: string;
}

const AWARDS: readonly AwardDefinition[] = [
  {
    id: "certified-ghost",
    label: "Certified Ghost",
    emoji: "👻",
    score: (person) => person.medianReplyTimeMin,
    detail: (person) => `median reply ${formatMinutes(person.medianReplyTimeMin)}`,
    metric: "median reply time",
    selection: "highest",
    meaning: "the slowest replier",
    lineInstruction: "Frame the winner as the slowest replier or the person who keeps others waiting; never praise their speed.",
    lineMustMatch: /\b(?:slow|slowest|wait|waiting|delay|delayed|late|later|offline|ghost|left\s+.+\s+hanging)\b/iu,
    oppositeDirection: /\b(?:fast|faster|fastest|quick|quicker|quickest|rapid|rapid-fire|instant|immediate|speedy|prompt)\b/iu,
  },
  {
    id: "main-character",
    label: "Main Character",
    emoji: "🎭",
    score: (person) => person.messageShare,
    detail: (person) => `${Math.round(person.messageShare * 100)}% of all messages`,
    metric: "message share",
    selection: "highest",
    meaning: "the person who sent the largest share of messages",
    lineInstruction: "Frame the winner as contributing the most or taking the largest share of the chat.",
    lineMustMatch: /(?:%|\bpercent\b|\b(?:message|messages|share|chat)\b)/iu,
    oppositeDirection: /\b(?:fewest|least|lowest|smallest)\s+(?:messages?|share)\b/iu,
  },
  {
    id: "3am-overthinker",
    label: "3AM Overthinker",
    emoji: "🌙",
    score: (person) => person.lateNightCount,
    detail: (person) => `${formatCount(person.lateNightCount)} late-night messages`,
    metric: "late-night message count",
    selection: "highest",
    meaning: "the person with the most late-night messages",
    lineInstruction: "Frame the winner as the most active late at night.",
    lineMustMatch: /\b(?:late[- ]night|night|midnight|3\s*a\.?m\.?)\b/iu,
    oppositeDirection: /\b(?:fewest|least|no)\s+(?:late[- ]night|night|midnight)\b/iu,
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
    metric: "average words per message",
    selection: "lowest",
    meaning: "the person with the shortest messages",
    lineInstruction: "Frame the winner as the briefest or most concise writer, because this award selects the lowest average.",
    lineMustMatch: /\b(?:word|words|short|shortest|brief|briefest|concise|fewest|tiny|one-liner|efficient)\b/iu,
    oppositeDirection: /\b(?:most|highest)\s+(?:words?|average)\b|\b(?:longest|wordiest)\b/iu,
  },
  {
    id: "comedian",
    label: "Comedian",
    emoji: "🎤",
    score: (person) => person.laughCount,
    detail: (person) => `${formatCount(person.laughCount)} laugh-messages`,
    metric: "laugh-message count",
    selection: "highest",
    meaning: "the person with the most laugh-messages",
    lineInstruction: "Frame the winner as producing the most laughter in the chat.",
    lineMustMatch: /\b(?:laugh|laughing|laughs|funny|joke|jokes|comedy|comedian|lol|lmao|rofl|keyboard-smash)\b/iu,
    oppositeDirection: /\b(?:fewest|least|no)\s+(?:laughs?|jokes?)\b|\bnever\s+(?:laughs?|jokes?)\b/iu,
  },
  {
    id: "the-initiator",
    label: "The Initiator",
    emoji: "🚀",
    score: (person) => person.conversationStarts,
    detail: (person) => `${formatCount(person.conversationStarts)} conversation starts`,
    metric: "conversation-start count",
    selection: "highest",
    meaning: "the person who started the most conversations",
    lineInstruction: "Frame the winner as the person who opens or restarts the chat most often.",
    lineMustMatch: /\b(?:start|starts|started|starting|first|open|opens|opened|opening|kick|kicks|kicked|initiate|initiates|initiated|initiator)\b/iu,
    oppositeDirection: /\b(?:fewest|least|no)\s+(?:starts?|openings?)\b|\b(?:never|rarely)\s+(?:starts?|initiates?|opens?)\b/iu,
  },
];

/** Award winners are selected only from deterministic person metrics. */
export function assignAwards(stats: Pick<ChatStats, "people">): Award[] {
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

export function getAwardMetricRule(awardId: string): AwardMetricRule | undefined {
  const definition = AWARDS.find((award) => award.id === awardId);
  if (!definition) return undefined;
  return {
    metric: definition.metric,
    selection: definition.selection,
    meaning: definition.meaning,
    lineInstruction: definition.lineInstruction,
  };
}

export function getAwardMetricValue(
  awardId: string,
  person: PersonStats,
): number | undefined {
  return AWARDS.find((award) => award.id === awardId)?.score(person);
}

export function getAwardLineDirectionError(
  awardId: string,
  line: string,
  options: { tied?: boolean } = {},
): string | null {
  const definition = AWARDS.find((award) => award.id === awardId);
  if (!definition) return `Unknown award id: ${awardId}.`;
  if (options.tied) {
    const acknowledgesTie = /\b(?:tie|tied|both|share|shared|equal|same|joint|co-winner|co-winners|matching|matched|identical|neither|everyone|each)\b/iu.test(line);
    if (definition.oppositeDirection?.test(line)) {
      return `${definition.label} line describes the opposite metric direction.`;
    }
    if (/\b(?:but|yet|however|still|tie-break|tiebreak)\b.{0,100}\b(?:longer|shorter|more|most|less|least|highest|lowest|slow|slower|slowest|fast|faster|fastest|large|larger|largest|small|smaller|smallest|few|fewer|fewest|lead|leader|led|beat|beats|won|winner|dominated|dominates|owned)\b/iu.test(line)) {
      return `${definition.label} line claims a strict winner even though the metric is tied.`;
    }
    return acknowledgesTie
      ? null
      : `${definition.label} line must explicitly acknowledge that the winning metric is tied.`;
  }
  if (definition.oppositeDirection?.test(line)) {
    return `${definition.label} line describes the opposite metric direction.`;
  }
  if (!definition.lineMustMatch.test(line)) {
    return `${definition.label} line must describe ${definition.meaning}.`;
  }
  return null;
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
