/**
 * Single source of truth for unlock pricing. A single purchase authorizes one
 * report, its keepsake PDF, and its Wrapped card. Amounts use Razorpay's
 * smallest currency unit: paise for INR and cents for USD.
 */
export const PRICING = {
  IN: {
    currency: "INR",
    single: { amount: 9900, label: "₹99" },
    pack10: { amount: 49900, label: "₹499", perReport: "₹49.90 per report" },
  },
  DEFAULT: {
    currency: "USD",
    single: { amount: 199, label: "$1.99" },
    pack10: { amount: 799, label: "$7.99", perReport: "$0.80 per report" },
  },
} as const;

export type PriceRegion = keyof typeof PRICING;

export interface PriceQuote {
  region: PriceRegion;
  currency: (typeof PRICING)[PriceRegion]["currency"];
  amount: number;
  label: string;
  /** Whether the USD/international path is switched on for this deployment. */
  international: boolean;
}

/**
 * International Payments (accepting non-INR/foreign cards) requires extra KYC
 * and approval on the Razorpay account. Until it is approved, keep this off
 * and everyone is quoted INR.
 */
export function isInternationalEnabled(): boolean {
  return process.env.RAZORPAY_INTERNATIONAL_ENABLED?.trim().toLowerCase() === "true";
}

/** India maps to IN and everyone else to DEFAULT. When international is off, always IN. */
export function resolveRegion(countryCode: string | null | undefined): PriceRegion {
  if (!isInternationalEnabled()) return "IN";
  return countryCode?.trim().toUpperCase() === "IN" ? "IN" : "DEFAULT";
}

export function resolvePriceQuote(countryCode: string | null | undefined): PriceQuote {
  const region = resolveRegion(countryCode);
  return {
    region,
    currency: PRICING[region].currency,
    amount: PRICING[region].single.amount,
    label: PRICING[region].single.label,
    international: isInternationalEnabled(),
  };
}
