/**
 * Single source of truth for unlock pricing. A single purchase authorizes one
 * report, its keepsake PDF, and its Wrapped card. Amounts use Razorpay's
 * smallest currency unit: paise for INR and cents for USD.
 */
export const PRICING = {
  IN: {
    currency: "INR",
    single: { amount: 4900, label: "₹49" },
    pack10: { amount: 39900, label: "₹399", perReport: "₹39.90 per report" },
  },
  DEFAULT: {
    currency: "USD",
    single: { amount: 199, label: "$1.99" },
    pack10: { amount: 599, label: "$5.99", perReport: "$0.80 per report" },
  },
} as const;

export type PriceRegion = keyof typeof PRICING;
export type ProductType = "single" | "pack10";

/** Credits granted per product. A single unlocks one report; a pack grants 10. */
export const PRODUCT_CREDITS: Record<ProductType, number> = {
  single: 1,
  pack10: 10,
};

export function isProductType(value: unknown): value is ProductType {
  return value === "single" || value === "pack10";
}

export interface PriceQuote {
  region: PriceRegion;
  currency: (typeof PRICING)[PriceRegion]["currency"];
  productType: ProductType;
  amount: number;
  label: string;
  credits: number;
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

export function resolvePriceQuote(
  countryCode: string | null | undefined,
  productType: ProductType = "single",
): PriceQuote {
  const region = resolveRegion(countryCode);
  const tier = PRICING[region][productType];
  return {
    region,
    currency: PRICING[region].currency,
    productType,
    amount: tier.amount,
    label: tier.label,
    credits: PRODUCT_CREDITS[productType],
    international: isInternationalEnabled(),
  };
}
