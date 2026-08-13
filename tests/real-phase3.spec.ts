import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../src/app/api/generate/route";
import { assignAwards } from "../src/lib/assignAwards";
import { computeStats } from "../src/lib/computeStats";
import { curateSample } from "../src/lib/curateSample";
import { parseWhatsApp } from "../src/lib/parseWhatsApp";
import { serializeGenerateReportInput } from "../src/lib/reportTransport";
import { parseReportContent } from "../src/lib/reportValidation";
import { geminiResponse, VALID_REPORT } from "./reportTestData";

const realExportPath = process.env.REAL_WHATSAPP_EXPORT;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.skipIf(!realExportPath)("Phase 3 real-export route check", () => {
  it("sends only derived stats and a curated sample, then returns valid ReportContent", async () => {
    const resolvedPath = path.resolve(realExportPath!);
    const bytes = await readFile(resolvedPath);
    const file = Object.assign(new Blob([bytes]), { name: path.basename(resolvedPath) });
    const parsed = await parseWhatsApp(file);
    const stats = computeStats(parsed);
    const awards = assignAwards(stats, "sweetheart");
    const sample = curateSample(parsed.messages);
    const input = serializeGenerateReportInput({
      mode: "sweetheart",
      subtype: "partners",
      userContext: "",
      stats,
      awards,
      sample,
    });
    const expectedReport = {
      ...VALID_REPORT,
      highlights: [],
      awardLines: awards.map((award) => ({
        awardId: award.id,
        line: testAwardLine(award.id, award.detail),
      })),
    };
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(expectedReport));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
    const report = parseReportContent(await response.json());
    const providerRequest = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const providerInput = JSON.parse(providerRequest.contents[0].parts[0].text);

    expect(response.status).toBe(200);
    expect(report).toEqual(expectedReport);
    expect(sample.length).toBeLessThan(parsed.messages.length);
    expect(Object.keys(providerInput).sort()).toEqual(
      ["mode", "subtype", "userContext", "stats", "awards", "sample"].sort(),
    );
    expect(providerInput.sample).toHaveLength(sample.length);
    expect(providerRequest.contents[0].parts[0].text).not.toContain("rawChat");
    expect(input.stats.firstMessageDate).not.toContain("Z");

    console.info({
      sourceMessages: parsed.messages.length,
      participantCount: stats.people.length,
      curatedMessages: sample.length,
      samplePerParticipant: stats.people
        .map((person) => sample.filter((message) => message.sender === person.name).length)
        .sort((left, right) => right - left),
      firstMessageLocal: input.stats.firstMessageDate,
      busiestDayLocal: input.stats.busiestDay.date,
      requestFields: Object.keys(providerInput),
      reportFields: Object.keys(report),
    });
  });
});

function testAwardLine(awardId: string, detail: string): string {
  const suffix: Record<string, string> = {
    "certified-ghost": "kept everyone waiting as the slowest reply.",
    "main-character": "took the largest message share.",
    "3am-overthinker": "landed after midnight in the late-night shift.",
    "one-word-warrior": "kept every message short and concise.",
    comedian: "kept the laughs coming.",
    "the-initiator": "opened and restarted the chat.",
    "perfectly-in-sync": "kept the reply rhythm matched.",
    "two-way-street": "kept the message split balanced.",
    "the-metronome": "kept the consecutive-day streak moving.",
    "the-lurker": "stayed present while keeping the message count quiet.",
    "the-novelist": "turned each message into a longer paragraph.",
    "reply-guy": "kept replies fast at the stated median.",
    "emoji-addict": "packed the stated emoji rate into every message.",
    "the-broadcaster": "shared the stated links and media total.",
    "the-double-texter": "ran the stated consecutive-message streak before a reply.",
    "the-reviver": "broke the stated number of long silences.",
    "weekend-warrior": "put the stated share of activity on weekends.",
  };
  return `${detail}; ${suffix[awardId]}`;
}
