import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_SAFETY_SETTINGS,
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
  vi.restoreAllMocks();
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
      ["mode", "subtype", "userContext", "stats", "awards", "sample", "receiptExchanges"].sort(),
    );
    expect(JSON.stringify(body)).not.toContain("server-secret");
    expect(JSON.stringify(body)).not.toContain("rawChat");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig).not.toHaveProperty("temperature");
    expect(body.generationConfig).not.toHaveProperty("top_p");
    expect(body.generationConfig).not.toHaveProperty("top_k");
    expect(body.contents.at(-1)?.role).toBe("user");
    expect(body.safetySettings).toEqual(GEMINI_SAFETY_SETTINGS);
    expect(body.safetySettings.every((setting: { threshold: string }) => setting.threshold === "BLOCK_NONE")).toBe(true);
    expect(body.generationConfig.responseSchema.properties.awardLines.minItems).toBe(
      providerInput.awards.length,
    );
    expect(body.generationConfig.responseSchema.properties.awardLines.maxItems).toBe(
      providerInput.awards.length,
    );
    expect(body.generationConfig.responseSchema.properties.highlights.items.properties.exchangeId)
      .toEqual({ type: "STRING", enum: ["exchange-01"] });
    expect(body.generationConfig.responseSchema.properties.highlights.minItems).toBe(1);
    expect(body.generationConfig.responseSchema.properties.highlights.maxItems).toBe(1);
    expect(providerInput.userContext).toBe("Together since university.");
    expect(body.contents[0].parts[0].text).toContain(
      '\"userContext\":\"Together since university.\"',
    );
    expect(body.systemInstruction.parts[0].text).toContain(
      "userContext · optional background supplied by the user in the create flow",
    );
    expect(body.systemInstruction.parts[0].text).toContain(
      "Use it to interpret the relationship, situation, and tone",
    );
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

  it("forbids reproducing slurs even in unfiltered modes", () => {
    const prompt = buildSystemPrompt(createTestGenerateInput("roast"));
    expect(prompt).toContain("NEVER reproduce slurs, identity attacks, or dehumanizing language");
    expect(prompt).toContain('Refer to "a slur" or redact the term');
    expect(prompt).toContain("Roast only the behavior proven by the chat");
  });

  it("uses birthday context as a whole-report creative brief", () => {
    const noContext = createTestGenerateInput("sweetheart");
    noContext.userContext = "";
    const birthday = createTestGenerateInput("sweetheart");
    birthday.userContext = "this is for her birthday";

    const plainPrompt = buildSystemPrompt(noContext);
    const birthdayPrompt = buildSystemPrompt(birthday);

    expect(birthdayPrompt).not.toBe(plainPrompt);
    expect(birthdayPrompt).toContain('The user supplied: "this is for her birthday"');
    expect(birthdayPrompt).toContain(
      "materially shape the title, heroLine, wrappedLine, highlight selection, narrative arc, chapter framing, and final emotional landing",
    );
    expect(birthdayPrompt).toContain("write a keepsake for that occasion");
    expect(plainPrompt).toContain("No occasion or extra context was supplied");
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
    expect(prompt).toContain("Never use em dashes or en dashes");
    expect(prompt).toContain("If you name a month, year, or date, it MUST come from the supplied milestone dates or messagesByMonth data");
    expect(prompt).toContain("Every named month, year, or date must come from the supplied milestone dates or messagesByMonth data");
    expect(prompt).not.toMatch(/[—–‑‒―]/u);
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
      'TIE RULE · MANDATORY FOR THIS LINE: "A" and "B" share this metric value. Explicitly use "tied", "shared", or "matched" in the line.',
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

  it("masks slurs before the first request and removes masked messages on a safety retry", async () => {
    const input = createTestGenerateInput("group");
    const slur = ["n", "igger"].join("");
    input.userContext = `Context containing ${slur} and ordinary damn profanity.`;
    input.sample[0] = { ...input.sample[0], text: `Source used ${slur} here. Damn.` };
    const cleanReport = {
      ...VALID_REPORT,
      highlights: [
        {
          label: VALID_REPORT.highlights[0].label,
          body: VALID_REPORT.highlights[0].body,
          exchangeId: "exchange-01",
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiSafetyBlockResponse())
      .mockResolvedValueOnce(geminiResponse(cleanReport));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(input)).resolves.toEqual(VALID_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      "[lores] Gemini content block",
      expect.objectContaining({ promptBlockReason: "SAFETY" }),
    );
    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const cleanRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(firstRequest.contents[0].parts[0].text).not.toContain(slur);
    expect(firstRequest.contents[0].parts[0].text).toContain("[slur removed]");
    expect(firstRequest.contents[0].parts[0].text).toContain("ordinary damn profanity");
    expect(cleanRequest.contents[0].parts[0].text).not.toContain(slur);
    expect(cleanRequest.contents[0].parts[0].text).not.toContain("Source used [slur removed] here. Damn.");
  });

  it("throws instead of returning a placeholder report when the sanitized retry is blocked", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(geminiSafetyBlockResponse()));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput("group"))).rejects.toBeInstanceOf(
      LlmRequestError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("materializes an indexed receipt as the exact consecutive source exchange", async () => {
    const input = createTestGenerateInput();
    const indexedReport = {
      ...VALID_REPORT,
      highlights: [
        {
          label: VALID_REPORT.highlights[0].label,
          body: VALID_REPORT.highlights[0].body,
          exchangeId: "exchange-01",
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(indexedReport));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    const report = await generateReport(input);

    expect(report.highlights[0].snippet).toEqual(input.receiptExchanges[0]);
    expect(report.highlights[0].snippet.messages).toHaveLength(4);
  });

  it("repairs a response that omits any computed award line", async () => {
    const incomplete = {
      ...VALID_REPORT,
      awardLines: VALID_REPORT.awardLines.slice(0, -1),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(incomplete))
      .mockResolvedValueOnce(geminiResponse(VALID_REPORT));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput())).resolves.toEqual(VALID_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairRequest.contents[0].parts[0].text).toContain(
      "Include exactly one non-empty awardLines entry for every ID",
    );
  });

  it("retries when a highlight references an unknown source exchange", async () => {
    const ungrounded = {
      ...VALID_REPORT,
      highlights: [{ label: "Wrong receipt", body: "Not grounded.", exchangeId: "exchange-99" }],
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
      "missing required field: snippet",
    );
  });

  it("repairs an empty highlight list when valid receipt exchanges were supplied", async () => {
    const missingReceipts = { ...VALID_REPORT, highlights: [] };
    const providerReport = {
      ...VALID_REPORT,
      highlights: [
        {
          label: VALID_REPORT.highlights[0].label,
          body: VALID_REPORT.highlights[0].body,
          exchangeId: "exchange-01",
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(missingReceipts))
      .mockResolvedValueOnce(geminiResponse(providerReport));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    const report = await generateReport(createTestGenerateInput());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(report.highlights).toHaveLength(1);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairRequest.contents[0].parts[0].text).toContain(
      "At least one highlight is required",
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

  it("repairs a narrative that invents a year outside the chat range", async () => {
    const inventedYear = {
      ...VALID_REPORT,
      narrative: "By May 2019, the chat had already found its rhythm.",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(inventedYear))
      .mockResolvedValueOnce(geminiResponse(VALID_REPORT));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput())).resolves.toEqual(VALID_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairRequest.contents[0].parts[0].text).toContain(
      "narrative names 2019, outside this chat's 2024-2024 date range",
    );
  });

  it("repairs a chapter that invents a year outside the chat range", async () => {
    const inventedYear = {
      ...VALID_REPORT,
      chapters: VALID_REPORT.chapters.map((chapter, index) =>
        index === 1 ? { ...chapter, body: "In March 2025, the next message arrived." } : chapter,
      ),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(inventedYear))
      .mockResolvedValueOnce(geminiResponse(VALID_REPORT));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput())).resolves.toEqual(VALID_REPORT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairRequest.contents[0].parts[0].text).toContain(
      "chapter 2 body names 2025, outside this chat's 2024-2024 date range",
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

  it("fails after three invalid outputs without returning placeholder copy", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(geminiResponse('{"title":"incomplete"}')),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateReport(createTestGenerateInput())).rejects.toBeInstanceOf(LlmOutputError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

function geminiSafetyBlockResponse(): Response {
  return Response.json({
    promptFeedback: {
      blockReason: "SAFETY",
      safetyRatings: [
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          probability: "HIGH",
          blocked: true,
        },
      ],
    },
  });
}

describe("stripCodeFences", () => {
  it("strips JSON fences but leaves unfenced JSON intact", () => {
    expect(stripCodeFences("```json\n{\"ok\":true}\n```")).toBe('{"ok":true}');
    expect(stripCodeFences(' {"ok":true} ')).toBe('{"ok":true}');
  });
});
