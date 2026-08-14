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
    await expect(response.json()).resolves.toMatchObject({
      content: VALID_REPORT,
      reportId: expect.any(String),
    });
  });

  it("defaults an omitted receiptExchanges field to an empty array", async () => {
    const input = structuredClone(createTestGenerateInput()) as Partial<
      ReturnType<typeof createTestGenerateInput>
    >;
    delete input.receiptExchanges;
    const reportWithoutReceipts = { ...VALID_REPORT, highlights: [] };
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(reportWithoutReceipts));
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(input));
    const providerRequest = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const providerInput = JSON.parse(providerRequest.contents[0].parts[0].text);

    expect(response.status).toBe(200);
    expect(providerInput.receiptExchanges).toEqual([]);
    expect(providerRequest.generationConfig.responseSchema.properties.highlights.maxItems).toBe(0);
    await expect(response.json()).resolves.toMatchObject({
      content: reportWithoutReceipts,
      reportId: expect.any(String),
    });
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
    await expect(response.json()).resolves.toMatchObject({
      content: ALTERNATE_REPORT,
      reportId: expect.any(String),
    });
  });

  it("rejects an extra raw-chat field before contacting the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ ...createTestGenerateInput(), rawChat: "private" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps missing configuration and exhausted JSON repairs to safe errors", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    const missingKey = await POST(request(createTestGenerateInput()));
    expect(missingKey.status).toBe(503);

    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(geminiResponse("not JSON"))),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const badOutput = await POST(request(createTestGenerateInput()));
    expect(badOutput.status).toBe(502);
    await expect(badOutput.json()).resolves.toEqual({ error: "Report generation failed." });
  });

  it("returns a generation error instead of placeholder content when both requests are blocked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Report generation failed." });
  });
});
