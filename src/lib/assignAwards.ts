import type { Award, ChatStats, PersonStats } from "./types";

type AwardStats = Pick<ChatStats, "people" | "longestStreakDays">;
type AwardSelection = "highest" | "lowest" | "closest" | "balanced" | "longest";

interface AwardRuleDefinition {
  id: string;
  label: string;
  emoji: string;
  metric: string;
  selection: AwardSelection;
  meaning: string;
  lineInstruction: string;
  lineMustMatch: RegExp;
  oppositeDirection?: RegExp;
}

interface PrimaryAwardDefinition extends AwardRuleDefinition {
  score: (person: PersonStats) => number;
  eligible?: (person: PersonStats) => boolean;
  direction?: "max" | "min";
  detail: (person: PersonStats) => string;
  qualifies: (winner: PersonStats, stats: AwardStats) => boolean;
}

interface AlternateAwardDefinition extends AwardRuleDefinition {
  qualifies: (stats: AwardStats) => boolean;
  create: (stats: AwardStats) => Award;
}

export interface AwardMetricRule {
  metric: string;
  selection: AwardSelection;
  meaning: string;
  lineInstruction: string;
}

export const AWARD_THRESHOLDS = {
  certifiedGhostMinMinutesExclusive: 30,
  lateNightMinMessagesExclusive: 20,
  oneWordMaxAverageExclusive: 4,
  comedianMinLaughMessagesExclusive: 30,
  mainCharacterMinShareExclusive: 0.6,
  initiatorMinShareExclusive: 0.6,
  perfectlyInSyncMaxGapMinutes: 5,
  metronomeMinStreakDays: 7,
} as const;

const MAX_REPORT_AWARDS = 6;

const PRIMARY_AWARDS: readonly PrimaryAwardDefinition[] = [
  {
    id: "certified-ghost",
    label: "Certified Ghost",
    emoji: "👻",
    score: (person) => person.medianReplyTimeMin,
    detail: (person) => `median reply ${formatMinutes(person.medianReplyTimeMin)}`,
    qualifies: (winner) =>
      winner.medianReplyTimeMin > AWARD_THRESHOLDS.certifiedGhostMinMinutesExclusive,
    metric: "median reply time",
    selection: "highest",
    meaning: "the slowest replier",
    lineInstruction:
      "Frame the winner as the slowest replier or the person who keeps others waiting; never praise their speed.",
    lineMustMatch:
      /\b(?:slow|slowest|wait|waiting|delay|delayed|late|later|offline|ghost|left\s+.+\s+hanging)\b/iu,
    oppositeDirection:
      /\b(?:fast|faster|fastest|quick|quicker|quickest|rapid|rapid-fire|instant|immediate|speedy|prompt)\b/iu,
  },
  {
    id: "main-character",
    label: "Main Character",
    emoji: "🎭",
    score: (person) => person.messageShare,
    detail: (person) => `${Math.round(person.messageShare * 100)}% of all messages`,
    qualifies: (winner) =>
      winner.messageShare > AWARD_THRESHOLDS.mainCharacterMinShareExclusive,
    metric: "message share",
    selection: "highest",
    meaning: "the person who sent the largest share of messages",
    lineInstruction:
      "Frame the winner as contributing the most or taking the largest share of the chat.",
    lineMustMatch: /(?:%|\bpercent\b|\b(?:message|messages|share|chat)\b)/iu,
    oppositeDirection: /\b(?:fewest|least|lowest|smallest)\s+(?:messages?|share)\b/iu,
  },
  {
    id: "3am-overthinker",
    label: "3AM Overthinker",
    emoji: "🌙",
    score: (person) => person.lateNightCount,
    detail: (person) => `${formatCount(person.lateNightCount)} late-night messages`,
    qualifies: (winner) =>
      winner.lateNightCount > AWARD_THRESHOLDS.lateNightMinMessagesExclusive,
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
    qualifies: (winner) =>
      winner.avgWordsPerMessage < AWARD_THRESHOLDS.oneWordMaxAverageExclusive,
    metric: "average words per message",
    selection: "lowest",
    meaning: "the person with the shortest messages",
    lineInstruction:
      "Frame the winner as the briefest or most concise writer, because this award selects the lowest average.",
    lineMustMatch:
      /\b(?:word|words|short|shortest|brief|briefest|concise|fewest|tiny|one-liner|efficient)\b/iu,
    oppositeDirection: /\b(?:most|highest)\s+(?:words?|average)\b|\b(?:longest|wordiest)\b/iu,
  },
  {
    id: "comedian",
    label: "Comedian",
    emoji: "🎤",
    score: (person) => person.laughCount,
    detail: (person) => `${formatCount(person.laughCount)} laugh-messages`,
    qualifies: (winner) =>
      winner.laughCount > AWARD_THRESHOLDS.comedianMinLaughMessagesExclusive,
    metric: "laugh-message count",
    selection: "highest",
    meaning: "the person with the most laugh-messages",
    lineInstruction: "Frame the winner as producing the most laughter in the chat.",
    lineMustMatch:
      /\b(?:laugh|laughing|laughs|funny|joke|jokes|comedy|comedian|lol|lmao|rofl|keyboard-smash)\b/iu,
    oppositeDirection:
      /\b(?:fewest|least|no)\s+(?:laughs?|jokes?)\b|\bnever\s+(?:laughs?|jokes?)\b/iu,
  },
  {
    id: "the-initiator",
    label: "The Initiator",
    emoji: "🚀",
    score: (person) => person.conversationStarts,
    detail: (person) => `${formatCount(person.conversationStarts)} conversation starts`,
    qualifies: (winner, stats) => {
      const total = stats.people.reduce((sum, person) => sum + person.conversationStarts, 0);
      return total > 0 && winner.conversationStarts / total > AWARD_THRESHOLDS.initiatorMinShareExclusive;
    },
    metric: "conversation-start count",
    selection: "highest",
    meaning: "the person who started the most conversations",
    lineInstruction: "Frame the winner as the person who opens or restarts the chat most often.",
    lineMustMatch:
      /\b(?:start|starts|started|starting|first|open|opens|opened|opening|kick|kicks|kicked|initiate|initiates|initiated|initiator)\b/iu,
    oppositeDirection:
      /\b(?:fewest|least|no)\s+(?:starts?|openings?)\b|\b(?:never|rarely)\s+(?:starts?|initiates?|opens?)\b/iu,
  },
];

const ALTERNATE_AWARDS: readonly AlternateAwardDefinition[] = [
  {
    id: "perfectly-in-sync",
    label: "Perfectly In Sync",
    emoji: "🫶",
    qualifies: (stats) => {
      if (stats.people.length < 2 || stats.people.some((person) => person.messageCount < 2)) {
        return false;
      }
      const replyTimes = stats.people.map((person) => person.medianReplyTimeMin);
      return Math.max(...replyTimes) - Math.min(...replyTimes) <=
        AWARD_THRESHOLDS.perfectlyInSyncMaxGapMinutes;
    },
    create: (stats) => {
      const replyTimes = stats.people.map((person) => person.medianReplyTimeMin);
      const min = Math.min(...replyTimes);
      const max = Math.max(...replyTimes);
      return {
        id: "perfectly-in-sync",
        label: "Perfectly In Sync",
        emoji: "🫶",
        who: joinPeople(stats.people),
        detail:
          min === max
            ? `matching ${formatMinutes(max)} median replies`
            : `reply medians within ${formatMinutes(max - min)}`,
      };
    },
    metric: "gap between participant median reply times",
    selection: "closest",
    meaning: "participants whose median reply times nearly match",
    lineInstruction:
      "Celebrate the participants' matched reply rhythm; this is a shared award, not a winner-versus-loser comparison.",
    lineMustMatch: /\b(?:sync|synced|rhythm|match|matched|matching|same|shared|together|within|reply|replies)\b/iu,
  },
  {
    id: "two-way-street",
    label: "Two-Way Street",
    emoji: "↔️",
    qualifies: (stats) =>
      stats.people.length >= 2 &&
      Math.max(...stats.people.map((person) => person.messageShare)) <=
        AWARD_THRESHOLDS.mainCharacterMinShareExclusive,
    create: (stats) => ({
      id: "two-way-street",
      label: "Two-Way Street",
      emoji: "↔️",
      who: joinPeople(stats.people),
      detail: `${stats.people.map((person) => `${Math.round(person.messageShare * 100)}%`).join(" / ")} message split`,
    }),
    metric: "message-share split",
    selection: "balanced",
    meaning: "participants with no one taking more than 60% of the chat",
    lineInstruction:
      "Describe the balanced split as a shared back-and-forth; do not crown a main character.",
    lineMustMatch: /(?:%|\b(?:balanced|balance|split|share|shared|two-way|back-and-forth|messages?)\b)/iu,
  },
  {
    id: "the-metronome",
    label: "The Metronome",
    emoji: "⏱️",
    qualifies: (stats) =>
      stats.longestStreakDays >= AWARD_THRESHOLDS.metronomeMinStreakDays,
    create: (stats) => ({
      id: "the-metronome",
      label: "The Metronome",
      emoji: "⏱️",
      who: joinPeople(stats.people),
      detail: `${formatCount(stats.longestStreakDays)}-day all-participant streak`,
    }),
    metric: "all-participant daily streak",
    selection: "longest",
    meaning: "a sustained run of consecutive days with everyone active",
    lineInstruction:
      "Describe the consistency of everyone showing up on consecutive days.",
    lineMustMatch: /\b(?:streak|day|days|daily|consecutive|consistent|consistency|showing up|rhythm)\b/iu,
  },
];

const ALL_AWARD_RULES: readonly AwardRuleDefinition[] = [
  ...PRIMARY_AWARDS,
  ...ALTERNATE_AWARDS,
];

/** Select only awards whose deterministic metric clears its qualifying gate. */
export function assignAwards(stats: AwardStats): Award[] {
  if (stats.people.length === 0) return [];

  const primaryAwards = PRIMARY_AWARDS.flatMap((definition) => {
    const candidates = stats.people.filter((person) => definition.eligible?.(person) ?? true);
    if (candidates.length === 0) return [];

    const winner = candidates.reduce((best, candidate) => {
      const bestScore = definition.score(best);
      const candidateScore = definition.score(candidate);
      const candidateWins =
        definition.direction === "min"
          ? candidateScore < bestScore
          : candidateScore > bestScore;
      return candidateWins ? candidate : best;
    });
    if (!definition.qualifies(winner, stats)) return [];

    return [{
      id: definition.id,
      label: definition.label,
      emoji: definition.emoji,
      who: winner.name,
      detail: definition.detail(winner),
    }];
  });

  const alternates = ALTERNATE_AWARDS
    .filter((definition) => definition.qualifies(stats))
    .map((definition) => definition.create(stats));

  return [...primaryAwards, ...alternates].slice(0, MAX_REPORT_AWARDS);
}

export function getAwardMetricRule(awardId: string): AwardMetricRule | undefined {
  const definition = ALL_AWARD_RULES.find((award) => award.id === awardId);
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
  return PRIMARY_AWARDS.find((award) => award.id === awardId)?.score(person);
}

export function getAwardLineDirectionError(
  awardId: string,
  line: string,
  options: { tied?: boolean } = {},
): string | null {
  const definition = ALL_AWARD_RULES.find((award) => award.id === awardId);
  if (!definition) return `Unknown award id: ${awardId}.`;
  if (options.tied) {
    const acknowledgesTie =
      /\b(?:tie|tied|both|share|shared|equal|same|joint|co-winner|co-winners|matching|matched|identical|neither|everyone|each)\b/iu.test(
        line,
      );
    if (definition.oppositeDirection?.test(line)) {
      return `${definition.label} line describes the opposite metric direction.`;
    }
    if (
      /\b(?:but|yet|however|still|tie-break|tiebreak)\b.{0,100}\b(?:longer|shorter|more|most|less|least|highest|lowest|slow|slower|slowest|fast|faster|fastest|large|larger|largest|small|smaller|smallest|few|fewer|fewest|lead|leader|led|beat|beats|won|winner|dominated|dominates|owned)\b/iu.test(
        line,
      )
    ) {
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

function joinPeople(people: readonly PersonStats[]): string {
  return people.map((person) => person.name).join(" & ");
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
