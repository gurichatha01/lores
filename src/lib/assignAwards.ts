import type { Award, ChatStats, PersonStats, ReportMode } from "./types";

type AwardStats = Pick<ChatStats, "people" | "longestStreakDays"> & { mode: ReportMode };
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
  score?: (person: PersonStats) => number;
  candidate: (stats: AwardStats) => AwardCandidate | null;
}

interface AwardCandidate {
  award: Award;
  winnerKey: string;
  strength: number;
  order: number;
}

export interface AwardMetricRule {
  metric: string;
  selection: AwardSelection;
  meaning: string;
  lineInstruction: string;
}

export const AWARD_THRESHOLDS = {
  certifiedGhostMinMinutesExclusive: 30,
  certifiedGhostMinReplies: 5,
  lateNightMinMessagesExclusive: 20,
  oneWordMaxAverageExclusive: 4,
  comedianMinLaughMessagesExclusive: 30,
  sailorMinCurseMessages: 10,
  mainCharacterMinShareExclusive: 0.6,
  initiatorMinShareExclusive: 0.6,
  initiatorMinStarts: 5,
  perfectlyInSyncMaxGapMinutes: 5,
  perfectlyInSyncMinReplies: 5,
  twoWayStreetMinMessages: 20,
  metronomeMinStreakDays: 7,
  lurkerMaxEvenShareRatio: 0.6,
  lurkerMinActiveSpanShare: 0.75,
  novelistMinMessages: 30,
  novelistMinAverageWords: 6,
  replyGuyMaxMedianMinutes: 5,
  replyGuyMinReplies: 10,
  emojiAddictMinEmojis: 20,
  emojiAddictMinPerMessage: 0.3,
  broadcasterMinItems: 10,
  doubleTexterMinRun: 5,
  reviverMinLongSilences: 2,
  weekendWarriorMinMessages: 20,
  weekendWarriorMinShare: 0.5,
} as const;

const TARGET_REPORT_AWARDS = 6;
const MAX_REPORT_AWARDS = 8;
const EXCEPTIONAL_SIGNAL = 2;

const AWARD_RULES: readonly AwardRuleDefinition[] = [
  personRule({
    id: "certified-ghost",
    label: "Certified Ghost",
    emoji: "👻",
    score: (person) => person.medianReplyTimeMin,
    direction: "max",
    eligible: (person) => person.replyCount >= AWARD_THRESHOLDS.certifiedGhostMinReplies,
    qualifies: (winner) => winner.medianReplyTimeMin > AWARD_THRESHOLDS.certifiedGhostMinMinutesExclusive,
    detail: (person) => `median reply ${formatMinutes(person.medianReplyTimeMin)}`,
    strength: (winner, people) => higherSignal(winner.medianReplyTimeMin, runnerUp(people, (person) => person.medianReplyTimeMin), AWARD_THRESHOLDS.certifiedGhostMinMinutesExclusive),
    metric: "median reply time",
    selection: "highest",
    meaning: "the slowest replier",
    lineInstruction: "Describe the winner's specific slow-reply behavior and cite the grounded reply-time detail; never praise their speed.",
    lineMustMatch: /\b(?:slow|slowest|wait|waiting|delay|delayed|late|later|offline|ghost|hanging|reply)\b/iu,
    oppositeDirection: /\b(?:fast|faster|fastest|quick|quickest|rapid|rapid-fire|instant|immediate|speedy|prompt)\b/iu,
  }),
  personRule({
    id: "main-character",
    label: "Main Character",
    emoji: "🎭",
    score: (person) => person.messageShare,
    direction: "max",
    qualifies: (winner) => winner.messageCount >= 20 && winner.messageShare > AWARD_THRESHOLDS.mainCharacterMinShareExclusive,
    detail: (person) => `${Math.round(person.messageShare * 100)}% of all messages`,
    strength: (winner, people) => higherSignal(winner.messageShare, runnerUp(people, (person) => person.messageShare), AWARD_THRESHOLDS.mainCharacterMinShareExclusive),
    metric: "message share",
    selection: "highest",
    meaning: "the person who sent the largest share of messages",
    lineInstruction: "Describe the winner's specific message-volume dominance and cite the grounded share.",
    lineMustMatch: /(?:%|\b(?:message|messages|share|chat)\b)/iu,
    oppositeDirection: /\b(?:fewest|least|lowest|smallest)\s+(?:messages?|share)\b/iu,
  }),
  personRule({
    id: "3am-overthinker",
    label: "3AM Overthinker",
    emoji: "🌙",
    score: (person) => person.lateNightCount,
    direction: "max",
    qualifies: (winner) => winner.lateNightCount > AWARD_THRESHOLDS.lateNightMinMessagesExclusive,
    detail: (person) => `${formatCount(person.lateNightCount)} late-night messages`,
    strength: (winner, people) => higherSignal(winner.lateNightCount, runnerUp(people, (person) => person.lateNightCount), AWARD_THRESHOLDS.lateNightMinMessagesExclusive),
    metric: "late-night message count",
    selection: "highest",
    meaning: "the person with the most late-night messages",
    lineInstruction: "Describe the winner's specific late-night activity and cite the grounded count.",
    lineMustMatch: /\b(?:late[- ]night|night|midnight|3\s*a\.?m\.?)\b/iu,
  }),
  personRule({
    id: "one-word-warrior",
    label: "One-Word Warrior",
    emoji: "🗿",
    score: (person) => person.avgWordsPerMessage,
    direction: "min",
    eligible: (person) => person.messageCount >= 20,
    qualifies: (winner) => winner.avgWordsPerMessage < AWARD_THRESHOLDS.oneWordMaxAverageExclusive,
    detail: (person) => `${formatDecimal(person.avgWordsPerMessage)} words per message`,
    strength: (winner, people) => lowerSignal(winner.avgWordsPerMessage, runnerDown(people, (person) => person.avgWordsPerMessage), AWARD_THRESHOLDS.oneWordMaxAverageExclusive),
    metric: "average words per message",
    selection: "lowest",
    meaning: "the person with the shortest messages",
    lineInstruction: "Describe the winner's specific concise-message habit and cite the grounded average.",
    lineMustMatch: /\b(?:word|words|short|brief|concise|tiny|one-liner|efficient)\b/iu,
    oppositeDirection: /\b(?:most|highest)\s+(?:words?|average)\b|\b(?:longest|wordiest)\b/iu,
  }),
  personRule({
    id: "comedian",
    label: "Comedian",
    emoji: "🎤",
    score: (person) => person.laughCount,
    direction: "max",
    qualifies: (winner) => winner.laughCount > AWARD_THRESHOLDS.comedianMinLaughMessagesExclusive,
    detail: (person) => `${formatCount(person.laughCount)} laugh-messages`,
    strength: (winner, people) => higherSignal(winner.laughCount, runnerUp(people, (person) => person.laughCount), AWARD_THRESHOLDS.comedianMinLaughMessagesExclusive),
    metric: "laugh-message count",
    selection: "highest",
    meaning: "the person with the most laugh-messages",
    lineInstruction: "Describe the winner's specific laughter pattern and cite the grounded laugh-message count.",
    lineMustMatch: /\b(?:laugh|laughing|funny|joke|comedy|comedian|lol|lmao|rofl)\b/iu,
  }),
  personRule({
    id: "the-sailor",
    label: "The Sailor",
    emoji: "🤬",
    score: (person) => person.profanityMessageCount,
    direction: "max",
    qualifies: (winner, stats) =>
      (stats.mode === "roast" || stats.mode === "group") &&
      winner.profanityMessageCount >= AWARD_THRESHOLDS.sailorMinCurseMessages,
    detail: (person) => `${formatCount(person.profanityMessageCount)} curse-messages`,
    strength: (winner, people) =>
      higherSignal(
        winner.profanityMessageCount,
        runnerUp(people, (person) => person.profanityMessageCount),
        AWARD_THRESHOLDS.sailorMinCurseMessages,
      ),
    metric: "profane-or-slur message count",
    selection: "highest",
    meaning: "the person who sent the most messages containing profanity or a slur",
    lineInstruction:
      "Describe only the volume or habit and cite the grounded curse-message count. Never quote, name, hint at, or reproduce any profane or slur term.",
    lineMustMatch: /\b(?:curse|cursing|profanity|profane|language|messages?)\b/iu,
  }),
  personRule({
    id: "the-initiator",
    label: "The Initiator",
    emoji: "🚀",
    score: (person) => person.conversationStarts,
    direction: "max",
    qualifies: (winner, stats) =>
      winner.conversationStarts >= AWARD_THRESHOLDS.initiatorMinStarts &&
      winner.conversationStarts / sum(stats.people, (person) => person.conversationStarts) > AWARD_THRESHOLDS.initiatorMinShareExclusive,
    detail: (person) => `${formatCount(person.conversationStarts)} conversation starts`,
    strength: (winner, people) => higherSignal(winner.conversationStarts / Math.max(1, sum(people, (person) => person.conversationStarts)), 0, AWARD_THRESHOLDS.initiatorMinShareExclusive),
    metric: "conversation-start count",
    selection: "highest",
    meaning: "the person who started the most conversations",
    lineInstruction: "Describe the winner's specific habit of opening or reviving the chat and cite the grounded count.",
    lineMustMatch: /\b(?:start|starts|started|open|opens|kick|initiate|initiator)\b/iu,
  }),
  personRule({
    id: "the-lurker",
    label: "The Lurker",
    emoji: "👀",
    score: (person) => person.messageShare,
    direction: "min",
    eligible: (person) => person.messageCount >= 10 && person.activeSpanShare >= AWARD_THRESHOLDS.lurkerMinActiveSpanShare,
    qualifies: (winner, stats) => stats.people.length > 2 && winner.messageShare < (1 / stats.people.length) * AWARD_THRESHOLDS.lurkerMaxEvenShareRatio,
    detail: (person) => `${formatCount(person.messageCount)} messages across ${Math.round(person.activeSpanShare * 100)}% of the chat span`,
    strength: (winner, people) => lowerSignal(winner.messageShare, runnerDown(people, (person) => person.messageShare), (1 / people.length) * AWARD_THRESHOLDS.lurkerMaxEvenShareRatio),
    metric: "message share with full-span presence",
    selection: "lowest",
    meaning: "the quietest participant who remained present throughout the chat",
    lineInstruction: "Describe the winner's specific low-volume but long-running presence and cite the grounded message count or span.",
    lineMustMatch: /\b(?:quiet|quietest|lurker|watch|watched|present|span|messages?)\b/iu,
  }),
  personRule({
    id: "the-novelist",
    label: "The Novelist",
    emoji: "✍️",
    score: (person) => person.avgWordsPerMessage,
    direction: "max",
    eligible: (person) => person.messageCount >= AWARD_THRESHOLDS.novelistMinMessages,
    qualifies: (winner, stats) => stats.people.length > 2 && winner.avgWordsPerMessage >= AWARD_THRESHOLDS.novelistMinAverageWords && winner.avgWordsPerMessage >= median(stats.people.map((person) => person.avgWordsPerMessage)) * 1.2,
    detail: (person) => `${formatDecimal(person.avgWordsPerMessage)} words per message`,
    strength: (winner, people) => higherSignal(winner.avgWordsPerMessage, runnerUp(people, (person) => person.avgWordsPerMessage), AWARD_THRESHOLDS.novelistMinAverageWords),
    metric: "average words per message",
    selection: "highest",
    meaning: "the participant who writes the longest messages on average",
    lineInstruction: "Describe the winner's specific long-message habit and cite the grounded average.",
    lineMustMatch: /\b(?:word|words|long|longest|paragraph|essay|novel|message)\b/iu,
  }),
  personRule({
    id: "reply-guy",
    label: "Reply Guy",
    emoji: "⚡",
    score: (person) => person.medianReplyTimeMin,
    direction: "min",
    eligible: (person) => person.replyCount >= AWARD_THRESHOLDS.replyGuyMinReplies,
    qualifies: (winner, stats) => stats.people.length > 2 && winner.medianReplyTimeMin <= AWARD_THRESHOLDS.replyGuyMaxMedianMinutes,
    detail: (person) => `${formatMinutes(person.medianReplyTimeMin)} median reply across ${formatCount(person.replyCount)} replies`,
    strength: (winner, people) => lowerSignal(winner.medianReplyTimeMin, runnerDown(people, (person) => person.medianReplyTimeMin), AWARD_THRESHOLDS.replyGuyMaxMedianMinutes),
    metric: "median reply time",
    selection: "lowest",
    meaning: "the fastest reliable replier",
    lineInstruction: "Describe the winner's specific fast-reply behavior and cite the grounded reply time and/or reply count.",
    lineMustMatch: /\b(?:fast|quick|instant|reply|replies|minute|minutes|median)\b/iu,
    oppositeDirection: /\b(?:slow|slowest|ghost|waiting)\b/iu,
  }),
  personRule({
    id: "emoji-addict",
    label: "Emoji Addict",
    emoji: "😍",
    score: (person) => person.emojisPerMessage,
    direction: "max",
    qualifies: (winner, stats) => stats.people.length > 2 && winner.emojiCount >= AWARD_THRESHOLDS.emojiAddictMinEmojis && winner.emojisPerMessage >= AWARD_THRESHOLDS.emojiAddictMinPerMessage,
    detail: (person) => `${formatDecimal(person.emojisPerMessage)} emojis per message (${formatCount(person.emojiCount)} total)`,
    strength: (winner, people) => higherSignal(winner.emojisPerMessage, runnerUp(people, (person) => person.emojisPerMessage), AWARD_THRESHOLDS.emojiAddictMinPerMessage),
    metric: "emojis per message",
    selection: "highest",
    meaning: "the participant who uses emojis most densely",
    lineInstruction: "Describe the winner's specific emoji habit and cite the grounded rate or count.",
    lineMustMatch: /\b(?:emoji|emojis|reaction|reactions|per message|total)\b/iu,
  }),
  personRule({
    id: "the-broadcaster",
    label: "The Broadcaster",
    emoji: "📡",
    score: (person) => person.linkCount + person.mediaCount,
    direction: "max",
    qualifies: (winner, stats) => stats.people.length > 2 && winner.linkCount + winner.mediaCount >= AWARD_THRESHOLDS.broadcasterMinItems,
    detail: (person) => `${formatCount(person.linkCount)} links + ${formatCount(person.mediaCount)} media shares`,
    strength: (winner, people) => higherSignal(winner.linkCount + winner.mediaCount, runnerUp(people, (person) => person.linkCount + person.mediaCount), AWARD_THRESHOLDS.broadcasterMinItems),
    metric: "combined link and media shares",
    selection: "highest",
    meaning: "the participant who broadcasts the most links and media",
    lineInstruction: "Describe the winner's specific link/media sharing behavior and cite the grounded counts.",
    lineMustMatch: /\b(?:link|links|media|share|shares|shared|broadcast)\b/iu,
  }),
  personRule({
    id: "the-double-texter",
    label: "The Double-Texter",
    emoji: "📲",
    score: (person) => person.maxConsecutiveMessages,
    direction: "max",
    qualifies: (winner, stats) => stats.people.length > 2 && winner.maxConsecutiveMessages >= AWARD_THRESHOLDS.doubleTexterMinRun,
    detail: (person) => `${formatCount(person.maxConsecutiveMessages)} consecutive messages without a reply`,
    strength: (winner, people) => higherSignal(winner.maxConsecutiveMessages, runnerUp(people, (person) => person.maxConsecutiveMessages), AWARD_THRESHOLDS.doubleTexterMinRun),
    metric: "longest consecutive un-replied message run",
    selection: "highest",
    meaning: "the participant with the longest run of messages before anyone else replied",
    lineInstruction: "Describe the winner's specific consecutive-message streak and cite the grounded run length.",
    lineMustMatch: /\b(?:consecutive|messages|texts|texting|reply|streak|run)\b/iu,
  }),
  personRule({
    id: "the-reviver",
    label: "The Reviver",
    emoji: "🫀",
    score: (person) => person.silenceRevivalCount,
    direction: "max",
    qualifies: (winner, stats) => stats.people.length > 2 && winner.silenceRevivalCount >= AWARD_THRESHOLDS.reviverMinLongSilences,
    detail: (person) => `${formatCount(person.silenceRevivalCount)} long silences broken`,
    strength: (winner, people) => higherSignal(winner.silenceRevivalCount, runnerUp(people, (person) => person.silenceRevivalCount), AWARD_THRESHOLDS.reviverMinLongSilences),
    metric: "long-silence revival count",
    selection: "highest",
    meaning: "the participant who most often returned after a silence longer than 24 hours",
    lineInstruction: "Describe the winner's specific habit of breaking long silences and cite the grounded count.",
    lineMustMatch: /\b(?:silence|silences|quiet|revive|revived|return|returned|restart|broke|broken)\b/iu,
  }),
  personRule({
    id: "weekend-warrior",
    label: "Weekend Warrior",
    emoji: "🗓️",
    score: (person) => person.weekendShare,
    direction: "max",
    qualifies: (winner, stats) => stats.people.length > 2 && winner.weekendMessageCount >= AWARD_THRESHOLDS.weekendWarriorMinMessages && winner.weekendShare >= AWARD_THRESHOLDS.weekendWarriorMinShare,
    detail: (person) => `${Math.round(person.weekendShare * 100)}% of messages on weekends (${formatCount(person.weekendMessageCount)})`,
    strength: (winner, people) => higherSignal(winner.weekendShare, runnerUp(people, (person) => person.weekendShare), AWARD_THRESHOLDS.weekendWarriorMinShare),
    metric: "weekend share of activity",
    selection: "highest",
    meaning: "the participant whose activity is most heavily skewed to weekends",
    lineInstruction: "Describe the winner's specific weekend-heavy activity and cite the grounded share or count.",
    lineMustMatch: /\b(?:weekend|weekends|saturday|sunday|messages|activity)\b/iu,
  }),
  sharedRule({
    id: "perfectly-in-sync",
    label: "Perfectly In Sync",
    emoji: "🫶",
    qualifies: (stats) =>
      stats.people.length === 2 &&
      stats.people.every((person) => person.replyCount >= AWARD_THRESHOLDS.perfectlyInSyncMinReplies) &&
      replyGap(stats.people) <= AWARD_THRESHOLDS.perfectlyInSyncMaxGapMinutes,
    create: (stats) => ({
      who: joinPeople(stats.people),
      detail: replyGap(stats.people) === 0 ? `matching ${formatMinutes(stats.people[0].medianReplyTimeMin)} median replies` : `reply medians within ${formatMinutes(replyGap(stats.people))}`,
      strength: 0.8 + 0.2 * (AWARD_THRESHOLDS.perfectlyInSyncMaxGapMinutes - replyGap(stats.people)) / AWARD_THRESHOLDS.perfectlyInSyncMaxGapMinutes,
    }),
    metric: "gap between participant median reply times",
    selection: "closest",
    meaning: "two participants whose median reply times nearly match",
    lineInstruction: "Describe their matched reply rhythm and cite the grounded timing; do not repeat either name.",
    lineMustMatch: /\b(?:sync|rhythm|match|same|shared|together|within|reply|replies)\b/iu,
  }),
  sharedRule({
    id: "two-way-street",
    label: "Two-Way Street",
    emoji: "↔️",
    qualifies: (stats) =>
      stats.people.length === 2 &&
      sum(stats.people, (person) => person.messageCount) >= AWARD_THRESHOLDS.twoWayStreetMinMessages &&
      Math.max(...stats.people.map((person) => person.messageShare)) <= AWARD_THRESHOLDS.mainCharacterMinShareExclusive,
    create: (stats) => ({
      who: joinPeople(stats.people),
      detail: `${stats.people.map((person) => `${Math.round(person.messageShare * 100)}%`).join(" / ")} message split`,
      strength: 0.8 + (0.1 - Math.abs(stats.people[0].messageShare - 0.5)) * 2,
    }),
    metric: "message-share split",
    selection: "balanced",
    meaning: "two participants with a balanced message split",
    lineInstruction: "Describe the grounded balanced split as shared back-and-forth; do not repeat either name.",
    lineMustMatch: /(?:%|\b(?:balanced|split|share|two-way|back-and-forth|messages?)\b)/iu,
  }),
  sharedRule({
    id: "the-metronome",
    label: "The Metronome",
    emoji: "⏱️",
    qualifies: (stats) => stats.longestStreakDays >= AWARD_THRESHOLDS.metronomeMinStreakDays,
    create: (stats) => ({
      who: stats.people.length > 2 ? `all ${stats.people.length} of you` : joinPeople(stats.people),
      detail: `${formatCount(stats.longestStreakDays)}-day all-participant streak`,
      strength: stats.people.length > 2 ? stats.longestStreakDays / AWARD_THRESHOLDS.metronomeMinStreakDays : Math.min(1, stats.longestStreakDays / AWARD_THRESHOLDS.metronomeMinStreakDays),
    }),
    metric: "all-participant daily streak",
    selection: "longest",
    meaning: "a sustained run of consecutive days with everyone active",
    lineInstruction: "Describe the group's grounded consecutive-day consistency; do not repeat participant names.",
    lineMustMatch: /\b(?:streak|day|days|daily|consecutive|consistent|rhythm)\b/iu,
  }),
];

/** Select threshold-clearing awards, ranked by signal and diversified across winners. */
export function assignAwards(
  stats: Pick<ChatStats, "people" | "longestStreakDays">,
  mode: ReportMode,
): Award[] {
  if (stats.people.length === 0) return [];

  const awardStats: AwardStats = { ...stats, mode };

  const candidates = AWARD_RULES.flatMap((rule, order) => {
    const candidate = rule.candidate(awardStats);
    return candidate ? [{ ...candidate, order }] : [];
  }).sort((left, right) => right.strength - left.strength || left.order - right.order);

  const exceptionalCount = candidates.filter((candidate) => candidate.strength >= EXCEPTIONAL_SIGNAL).length;
  const limit = Math.min(MAX_REPORT_AWARDS, Math.max(TARGET_REPORT_AWARDS, exceptionalCount));
  const selected: AwardCandidate[] = [];
  const winners = new Set<string>();

  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (candidate.winnerKey !== "@collective" && !winners.has(candidate.winnerKey)) {
      selected.push(candidate);
      winners.add(candidate.winnerKey);
    }
  }
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }

  return selected.map((candidate) => candidate.award);
}

export function getAwardMetricRule(awardId: string): AwardMetricRule | undefined {
  const definition = AWARD_RULES.find((award) => award.id === awardId);
  if (!definition) return undefined;
  return {
    metric: definition.metric,
    selection: definition.selection,
    meaning: definition.meaning,
    lineInstruction: definition.lineInstruction,
  };
}

export function getAwardMetricValue(awardId: string, person: PersonStats): number | undefined {
  return AWARD_RULES.find((award) => award.id === awardId)?.score?.(person);
}

export function getAwardLineDirectionError(awardId: string, line: string, options: { tied?: boolean } = {}): string | null {
  const definition = AWARD_RULES.find((award) => award.id === awardId);
  if (!definition) return `Unknown award id: ${awardId}.`;
  if (definition.oppositeDirection?.test(line)) return `${definition.label} line describes the opposite metric direction.`;
  if (options.tied) {
    if (/\b(?:but|yet|however|still|tie-break|tiebreak)\b.{0,100}\b(?:longer|shorter|more|most|less|least|highest|lowest|slow|slower|slowest|fast|faster|fastest|large|larger|largest|small|smaller|smallest|few|fewer|fewest|lead|leader|led|beat|beats|won|winner|dominated|dominates|owned)\b/iu.test(line)) {
      return `${definition.label} line claims a strict winner even though the metric is tied.`;
    }
    if (!/\b(?:tie|tied|both|share|shared|equal|same|joint|co-winner|co-winners|matching|matched|identical|neither|everyone|each)\b/iu.test(line)) {
      return `${definition.label} line must explicitly acknowledge that the winning metric is tied.`;
    }
  }
  if (!definition.lineMustMatch.test(line)) return `${definition.label} line must describe ${definition.meaning}.`;
  return null;
}

interface PersonRuleOptions extends Omit<AwardRuleDefinition, "candidate"> {
  score: (person: PersonStats) => number;
  direction: "max" | "min";
  eligible?: (person: PersonStats) => boolean;
  qualifies: (winner: PersonStats, stats: AwardStats) => boolean;
  detail: (winner: PersonStats) => string;
  strength: (winner: PersonStats, people: readonly PersonStats[]) => number;
}

function personRule(options: PersonRuleOptions): AwardRuleDefinition {
  return {
    ...options,
    candidate: (stats) => {
      const people = stats.people.filter((person) => options.eligible?.(person) ?? true);
      if (people.length === 0) return null;
      const winner = people.reduce((best, person) => {
        const difference = options.score(person) - options.score(best);
        return options.direction === "max" ? (difference > 0 ? person : best) : (difference < 0 ? person : best);
      });
      if (!options.qualifies(winner, stats)) return null;
      return {
        award: { id: options.id, label: options.label, emoji: options.emoji, who: winner.name, detail: options.detail(winner) },
        winnerKey: winner.name,
        strength: options.strength(winner, people),
        order: 0,
      };
    },
  };
}

interface SharedRuleOptions extends Omit<AwardRuleDefinition, "candidate"> {
  qualifies: (stats: AwardStats) => boolean;
  create: (stats: AwardStats) => { who: string; detail: string; strength: number };
}

function sharedRule(options: SharedRuleOptions): AwardRuleDefinition {
  return {
    ...options,
    candidate: (stats) => {
      if (!options.qualifies(stats)) return null;
      const created = options.create(stats);
      return {
        award: { id: options.id, label: options.label, emoji: options.emoji, who: created.who, detail: created.detail },
        winnerKey: "@collective",
        strength: created.strength,
        order: 0,
      };
    },
  };
}

function higherSignal(winner: number, second: number, threshold: number): number {
  return winner / Math.max(threshold, 0.001) + Math.max(0, winner - second) / Math.max(winner, 0.001);
}

function lowerSignal(winner: number, second: number, threshold: number): number {
  return threshold / Math.max(winner, 0.001) + Math.max(0, second - winner) / Math.max(second, 0.001);
}

function runnerUp(people: readonly PersonStats[], score: (person: PersonStats) => number): number {
  return [...people].map(score).sort((left, right) => right - left)[1] ?? 0;
}

function runnerDown(people: readonly PersonStats[], score: (person: PersonStats) => number): number {
  return [...people].map(score).sort((left, right) => left - right)[1] ?? 0;
}

function sum(people: readonly PersonStats[], score: (person: PersonStats) => number): number {
  return people.reduce((total, person) => total + score(person), 0);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function replyGap(people: readonly PersonStats[]): number {
  return Math.abs(people[0].medianReplyTimeMin - people[1].medianReplyTimeMin);
}

function joinPeople(people: readonly PersonStats[]): string {
  return people.map((person) => person.name).join(" & ");
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return "<1m";
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
