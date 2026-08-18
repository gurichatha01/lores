import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../src/app/api/pricing/route";
import { PRICING, resolvePriceQuote } from "../src/lib/pricing";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("single-report pricing", () => {
  it("uses the final India single price and defines the deferred pack without wiring it", async () => {
    vi.stubEnv("RAZORPAY_INTERNATIONAL_ENABLED", "false");
    const quote = resolvePriceQuote("IN");

    expect(PRICING.IN).toEqual({
      currency: "INR",
      single: { amount: 4900, label: "₹49" },
      pack10: { amount: 39900, label: "₹399", perReport: "₹39.90 per report" },
    });
    expect(quote).toMatchObject({ currency: "INR", amount: 4900, label: "₹49" });

    const response = GET(new Request("http://localhost/api/pricing"));
    await expect(response.json()).resolves.toMatchObject({ amount: 4900, label: "₹49" });
  });

  it("uses the default USD single price only when international payments are enabled", () => {
    vi.stubEnv("RAZORPAY_INTERNATIONAL_ENABLED", "true");
    expect(resolvePriceQuote("US")).toMatchObject({
      region: "DEFAULT",
      currency: "USD",
      amount: 149,
      label: "$1.49",
    });
    expect(PRICING.DEFAULT.pack10.perReport).toBe("$0.60 per report");
  });
});
