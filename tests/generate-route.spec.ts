import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../src/app/api/generate/route";
import {
  ALTERNATE_REPORT,
  createAlternateGenerateInput,
  createTestGenerateInput,
  geminiResponse,
  VALID_REPORT,
} from "./reportTestData";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request(body: unknown): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  it("returns valid ReportContent for a valid engine payload", async () => {
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse(VALID_REPORT)));

    const response = await POST(request(createTestGenerateInput()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(VALID_REPORT);
  });

  it("preserves freeform context from the API payload through to the LLM request", async () => {
    const input = createTestGenerateInput();
    input.userContext = "We met in film school and Trip Math is an inside joke.";
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(VALID_REPORT));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(input));
    const providerRequest = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const providerInput = JSON.parse(providerRequest.contents[0].parts[0].text);

    expect(response.status).toBe(200);
    expect(providerInput.userContext).toBe(input.userContext);
    expect(providerRequest.systemInstruction.parts[0].text).toContain(
      "Use it to interpret the relationship, situation, and tone",
    );
  });

  it("accepts deterministic shared recipients for alternate awards", async () => {
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse(ALTERNATE_REPORT)));

    const response = await POST(request(createAlternateGenerateInput()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(ALTERNATE_REPORT);
  });

  it("rejects an extra raw-chat field before contacting the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ ...createTestGenerateInput(), rawChat: "private" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps missing configuration safely and falls back on invalid model output", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    const missingKey = await POST(request(createTestGenerateInput()));
    expect(missingKey.status).toBe(503);

    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(geminiResponse("not JSON"))),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const badOutput = await POST(request(createTestGenerateInput()));
    expect(badOutput.status).toBe(200);
    await expect(badOutput.json()).resolves.toEqual(
      expect.objectContaining({
        title: "Your chat, by the numbers",
        heroLine: expect.stringContaining("could not be completed"),
      }),
    );
  });

  it("returns a stats-only report instead of 502 when Gemini blocks both attempts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          Response.json({ promptFeedback: { blockReason: "SAFETY", safetyRatings: [] } }),
        ),
      ),
    );

    const response = await POST(request(createTestGenerateInput("group")));
    const report = await response.json();

    expect(response.status).toBe(200);
    expect(report.title).toBe("Your chat, by the numbers");
    expect(report.heroLine).toContain("could not be processed safely");
  });
});
