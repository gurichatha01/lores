import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../src/app/api/generate/route";
import { createTestGenerateInput, geminiResponse, VALID_REPORT } from "./reportTestData";

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
