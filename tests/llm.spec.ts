import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_GEMINI_MODEL,
  generateReport,
  LlmConfigurationError,
  LlmOutputError,
  LlmRequestError,
  stripCodeFences,
} from "../src/lib/llm";
import { createTestGenerateInput, geminiResponse, VALID_REPORT } from "./reportTestData";

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
