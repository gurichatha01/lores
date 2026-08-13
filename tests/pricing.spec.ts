import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../src/app/api/pricing/route";
import { PRICING, resolvePriceQuote } from "../src/lib/pricing";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("introductory pricing", () => {
  it("keeps the actual India charge at ₹149 and exposes the genuine ₹299 regular price", async () => {
    vi.stubEnv("RAZORPAY_INTERNATIONAL_ENABLED", "false");
    const quote = resolvePriceQuote("IN");

    expect(PRICING.IN.amount).toBe(14_900);
    expect(quote).toMatchObject({
      currency: "INR",
      amount: 14_900,
      display: "₹149",
      regularDisplay: "₹299",
      offerLabel: "Launch price",
    });

    const response = GET(new Request("http://localhost/api/pricing"));
    await expect(response.json()).resolves.toMatchObject({
      amount: 14_900,
      display: "₹149",
      regularDisplay: "₹299",
      offerLabel: "Launch price",
    });
  });
});
