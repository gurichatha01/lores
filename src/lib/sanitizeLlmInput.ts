import type { GenerateReportInput } from "./types";

export const SLUR_PLACEHOLDER = "[slur removed]";

// Identity-targeting terms only. Ordinary profanity is intentionally left intact
// so non-gift modes can still match the chat's natural register.
const SLUR_TOKEN =
  /(?<![\p{L}\p{N}])(?:n[i1!|]gg(?:er|a)s?|f[a@]gg?(?:ot|ots?)?|ch[i1]nks?|k[i1]kes?|sp[i1]cs?|tr[a@]nn(?:y|ies)|r[e3]t[a@]rds?|p[a@]k[i1]s?|ch[i1]nk[i1]s?)(?![\p{L}\p{N}])/giu;

export function maskSlurs(value: string): string {
  return value.replace(SLUR_TOKEN, SLUR_PLACEHOLDER);
}

export function sanitizeLlmInput(input: GenerateReportInput): GenerateReportInput {
  return {
    ...input,
    userContext: maskSlurs(input.userContext),
    stats: {
      ...input.stats,
      people: input.stats.people.map((person) => ({
        ...person,
        topWords: person.topWords.filter((word) => maskSlurs(word) === word),
      })),
    },
    sample: input.sample.map((message) => ({
      ...message,
      text: maskSlurs(message.text),
    })),
  };
}
