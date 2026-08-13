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

  it("maps missing configuration and invalid model output to safe errors", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    const missingKey = await POST(request(createTestGenerateInput()));
    expect(missingKey.status).toBe(503);

    vi.stubEnv("LLM_API_KEY", "server-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(geminiResponse("not JSON"))),
    );
    const badOutput = await POST(request(createTestGenerateInput()));
    expect(badOutput.status).toBe(502);
    await expect(badOutput.json()).resolves.toEqual({ error: "Report generation failed." });
  });
});
