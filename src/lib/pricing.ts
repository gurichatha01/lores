/**
 * Single source of truth for unlock pricing.
 *
 * India is priced in INR, everyone else in USD. The two prices are NOT a
 * currency conversion of each other ($2.99 ≈ ₹249) · ₹149 is a deliberate
 * India-specific price, not a bug. One unlock unlocks everything (full report
 * + PDF + Wrapped card).
 *
 * Amounts are in the smallest currency unit Razorpay expects: paise for INR,
 * cents for USD.
 */
export const PRICING = {
  IN: {
    currency: "INR",
    amount: 14900,
    display: "₹149",
    regularDisplay: "₹299",
    offerLabel: "Launch price",
  }, // amount in paise
  US: { currency: "USD", amount: 299, display: "$2.99" }, // amount in cents
} as const;

export type PriceRegion = keyof typeof PRICING;

export interface PriceQuote {
  region: PriceRegion;
  currency: (typeof PRICING)[PriceRegion]["currency"];
  amount: number;
  display: string;
  regularDisplay?: string;
  offerLabel?: string;
  /** Whether the USD/international path is switched on for this deployment. */
  international: boolean;
}

/**
 * International Payments (accepting non-INR/foreign cards) requires extra KYC
 * and approval on the Razorpay account. Until it's approved, keep this off and
 * everyone is quoted INR · do NOT block launch on international approval.
 */
export function isInternationalEnabled(): boolean {
  return process.env.RAZORPAY_INTERNATIONAL_ENABLED?.trim().toLowerCase() === "true";
}

/** India → IN; everyone else → US. When international is off, always IN. */
export function resolveRegion(countryCode: string | null | undefined): PriceRegion {
  if (!isInternationalEnabled()) {
    return "IN";
  }
  return countryCode?.trim().toUpperCase() === "IN" ? "IN" : "US";
}

export function resolvePriceQuote(countryCode: string | null | undefined): PriceQuote {
  const region = resolveRegion(countryCode);
  return {
    region,
    ...PRICING[region],
    international: isInternationalEnabled(),
  };
}
