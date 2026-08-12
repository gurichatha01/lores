import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_GEMINI_MODEL,
  buildSystemPrompt,
  generateReport,
  LlmConfigurationError,
  LlmOutputError,
  LlmRequestError,
  stripCodeFences,
  MODE_VOICE_BLOCKS,
} from "../src/lib/llm";
import { REPORT_MODES } from "../src/lib/modePresets";
import {
  ALTERNATE_REPORT,
  createAlternateGenerateInput,
  createTestGenerateInput,
  createTiedGenerateInput,
  geminiResponse,
  TIED_REPORT,
  VALID_REPORT,
} from "./reportTestData";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("generateReport", () => {
  it("calls Gemini Flash server-side and returns strictly validated fenced JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(`\`\`\`json\n${JSON.stringify(VALID_REPORT)}\n\`\`\``));
    vi.stubEnv("LLM_PROVIDER", "gemini");
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput())).resolves.toEqual(VALID_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("server-secret");
    const body = JSON.parse(String(init.body));
    const providerInput = JSON.parse(body.contents[0].parts[0].text);
    expect(Object.keys(providerInput).sort()).toEqual(
      ["mode", "subtype", "userContext", "stats", "awards", "sample"].sort(),
    );
    expect(JSON.stringify(body)).not.toContain("server-secret");
    expect(JSON.stringify(body)).not.toContain("rawChat");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig).not.toHaveProperty("temperature");
    expect(body.generationConfig).not.toHaveProperty("top_p");
    expect(body.generationConfig).not.toHaveProperty("top_k");
    expect(body.contents.at(-1)?.role).toBe("user");
  });

  it("keeps the Gemini model independently swappable", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(geminiResponse(VALID_REPORT)));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubEnv("LLM_MODEL", "gemini-3.5-flash-lite");
    vi.stubGlobal("fetch", fetchMock);

    await generateReport(createTestGenerateInput());

    expect(fetchMock.mock.calls[0][0]).toContain("/models/gemini-3.5-flash-lite:generateContent");
  });

  it("injects the selected mode voice block without model prefilling", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(geminiResponse(VALID_REPORT)));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    for (const mode of REPORT_MODES) {
      await generateReport(createTestGenerateInput(mode));
      const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
      expect(body.systemInstruction.parts[0].text).toContain(MODE_VOICE_BLOCKS[mode]);
      expect(body.contents).toHaveLength(1);
      expect(body.contents.at(-1)?.role).toBe("user");
      expect(body.generationConfig).not.toHaveProperty("temperature");
      expect(body.generationConfig).not.toHaveProperty("top_p");
      expect(body.generationConfig).not.toHaveProperty("top_k");
    }
  });

  it("keeps gift modes cleaner while other modes match the chat's language", () => {
    for (const mode of ["sweetheart", "family"] as const) {
      expect(MODE_VOICE_BLOCKS[mode]).toContain("one notch cleaner");
      expect(MODE_VOICE_BLOCKS[mode]).toContain("no hard profanity");
    }
    for (const mode of ["ride-or-die", "group", "work", "roast"] as const) {
      expect(MODE_VOICE_BLOCKS[mode]).toContain("match the chat's own language and level");
      expect(MODE_VOICE_BLOCKS[mode]).not.toContain("no hard profanity");
    }
  });

  it("lets an affectionate Sweetheart source lead with genuine softness", () => {
    expect(MODE_VOICE_BLOCKS.sweetheart).toContain(
      "if the chat is affectionate, write with genuine affection and let that softness lead",
    );
    expect(MODE_VOICE_BLOCKS.sweetheart).toContain(
      "do not default to banter, savagery, sarcasm, or a roast in disguise",
    );
    expect(MODE_VOICE_BLOCKS.sweetheart).toContain(
      "Tease only when the messages themselves clearly support it",
    );
  });

  it("uses the specificity rules, all three few-shots, guardrails, and strict output shape", () => {
    const input = createTestGenerateInput("sweetheart");
    const prompt = buildSystemPrompt(input);

    expect(prompt).toContain("THE ONE RULE: specificity");
    expect(prompt).toContain("journey, bond, connection, sanctuary");
    expect(prompt).toContain("143 messages that were pure keyboard-smash");
    expect(prompt).toContain("murgh malai tikka vs dal roti");
    expect(prompt).toContain("The Whale Phase");
    expect(prompt).toContain("No insults about appearance, identity, intelligence");
    expect(prompt).toContain("exactly 4");
    expect(prompt).toContain('"wrappedLine"');
    expect(prompt).not.toContain("[INJECT");
    expect(prompt).not.toContain("[LENGTH]");
    expect(prompt).toContain(
      'Certified Ghost (certified-ghost): winner "B" has the HIGHEST median reply time, meaning the slowest replier.',
    );
    expect(prompt).toContain(
      'Main Character (main-character): winner "A" has the HIGHEST message share',
    );
    expect(prompt).toContain(
      '3AM Overthinker (3am-overthinker): winner "A" has the HIGHEST late-night message count',
    );
    expect(prompt).toContain(
      'One-Word Warrior (one-word-warrior): winner "B" has the LOWEST average words per message',
    );
    expect(prompt).toContain(
      'Comedian (comedian): winner "A" has the HIGHEST laugh-message count',
    );
    expect(prompt).toContain(
      'The Initiator (the-initiator): winner "A" has the HIGHEST conversation-start count',
    );
    const tiedPrompt = buildSystemPrompt(createTiedGenerateInput("sweetheart"));
    expect(tiedPrompt).toContain(
      'TIE RULE — MANDATORY FOR THIS LINE: "A" and "B" share this metric value. Explicitly use "tied", "shared", or "matched" in the line.',
    );
  });

  it("passes qualifying alternate awards through the prompt and output validator", async () => {
    const input = createAlternateGenerateInput();
    const prompt = buildSystemPrompt(input);
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(ALTERNATE_REPORT));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    expect(prompt).toContain("Perfectly In Sync (perfectly-in-sync)");
    expect(prompt).toContain("Two-Way Street (two-way-street)");
    expect(prompt).toContain("The Metronome (the-metronome)");
    await expect(generateReport(input)).resolves.toEqual(ALTERNATE_REPORT);
  });

  it("rejects award winners or details that do not match the person metrics", async () => {
    const input = createTestGenerateInput();
    input.awards = input.awards.map((award) =>
      award.id === "certified-ghost" ? { ...award, who: "A" } : award,
    );
    const fetchMock = vi.fn();
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(input)).rejects.toThrow(
      "Award winners and details must match the deterministic person metrics",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries exactly once when Gemini returns invalid report JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse("not JSON"))
      .mockResolvedValueOnce(geminiResponse(VALID_REPORT));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput())).resolves.toEqual(VALID_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries when a highlight bubble is not a verbatim sampled message", async () => {
    const ungrounded = {
      ...VALID_REPORT,
      highlights: [{ ...VALID_REPORT.highlights[0], bubble: "a paraphrased message" }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(ungrounded))
      .mockResolvedValueOnce(geminiResponse(VALID_REPORT));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput())).resolves.toEqual(VALID_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairRequest.contents).toHaveLength(1);
    expect(repairRequest.contents[0].role).toBe("user");
    expect(repairRequest.contents[0].parts[0].text).toContain(
      "Every highlight bubble must exactly match",
    );
  });

  it("retries an award line that describes the opposite metric direction", async () => {
    const wrongDirection = {
      ...VALID_REPORT,
      awardLines: VALID_REPORT.awardLines.map((awardLine) =>
        awardLine.awardId === "certified-ghost"
          ? { ...awardLine, line: "A rapid-fire 45m reply kept the chat moving." }
          : awardLine,
      ),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(wrongDirection))
      .mockResolvedValueOnce(geminiResponse(VALID_REPORT));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput())).resolves.toEqual(VALID_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairRequest.contents[0].parts[0].text).toContain(
      "Certified Ghost line describes the opposite metric direction",
    );
  });

  it("retries an award line that cites another statistic", async () => {
    const wrongStat = {
      ...VALID_REPORT,
      awardLines: VALID_REPORT.awardLines.map((awardLine) =>
        awardLine.awardId === "main-character"
          ? { ...awardLine, line: "Took the largest share with 99% of all messages." }
          : awardLine,
      ),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(wrongStat))
      .mockResolvedValueOnce(geminiResponse(VALID_REPORT));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput())).resolves.toEqual(VALID_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairRequest.contents[0].parts[0].text).toContain(
      "Main Character line must use its winner's computed detail",
    );
  });

  it("rejects a tied award line that claims the tie-break winner truly led", async () => {
    const input = createTiedGenerateInput();
    const ignoresTie = {
      ...TIED_REPORT,
      awardLines: TIED_REPORT.awardLines.map((awardLine) =>
        awardLine.awardId === "certified-ghost"
          ? { ...awardLine, line: "Shared a tied 45m, but still won as the slower replier." }
          : awardLine,
      ),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(ignoresTie))
      .mockResolvedValueOnce(geminiResponse(TIED_REPORT));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(input)).resolves.toEqual(TIED_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairRequest.contents[0].parts[0].text).toContain(
      "Certified Ghost line claims a strict winner even though the metric is tied",
    );
  });

  it("requires a tied award line to say the metric is tied, shared, or matched", async () => {
    const input = createTiedGenerateInput();
    const noTieContext = {
      ...TIED_REPORT,
      awardLines: TIED_REPORT.awardLines.map((awardLine) =>
        awardLine.awardId === "certified-ghost"
          ? { ...awardLine, line: "Waited through a median reply of 45m." }
          : awardLine,
      ),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(noTieContext))
      .mockResolvedValueOnce(geminiResponse(TIED_REPORT));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(input)).resolves.toEqual(TIED_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairRequest.contents[0].parts[0].text).toContain(
      "Certified Ghost line must explicitly acknowledge that the winning metric is tied",
    );
  });

  it("fails after two invalid outputs without adding more retries", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(geminiResponse('{"title":"incomplete"}')),
    );
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput())).rejects.toBeInstanceOf(LlmOutputError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported providers, missing keys, and HTTP failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("no", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    vi.stubEnv("LLM_PROVIDER", "other");
    await expect(generateReport(createTestGenerateInput())).rejects.toBeInstanceOf(LlmConfigurationError);

    vi.stubEnv("LLM_PROVIDER", "gemini");
    vi.stubEnv("LLM_API_KEY", "");
    await expect(generateReport(createTestGenerateInput())).rejects.toBeInstanceOf(LlmConfigurationError);

    vi.stubEnv("LLM_API_KEY", "server-secret");
    await expect(generateReport(createTestGenerateInput())).rejects.toBeInstanceOf(LlmRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("stripCodeFences", () => {
  it("strips JSON fences but leaves unfenced JSON intact", () => {
    expect(stripCodeFences("```json\n{\"ok\":true}\n```")).toBe('{"ok":true}');
    expect(stripCodeFences(' {"ok":true} ')).toBe('{"ok":true}');
  });
});
