import { resolvePriceQuote } from "../../../lib/pricing";
import { detectCountry } from "../../../lib/razorpay";

export const runtime = "nodejs";

/**
 * Quote-only endpoint so the teaser can display the correct price without
 * creating an order. The price is decided server-side from geo headers; the
 * client never computes or sends an amount.
 */
export function GET(request: Request): Response {
  const country = detectCountry(request);
  const single = resolvePriceQuote(country, "single");
  const pack = resolvePriceQuote(country, "pack10");
  return Response.json({
    // Backward-compatible single-report fields (the teaser unlock bar reads these).
    currency: single.currency,
    amount: single.amount,
    label: single.label,
    region: single.region,
    international: single.international,
    // Product breakdown for the pack upsell.
    single: { amount: single.amount, label: single.label, credits: single.credits },
    pack10: { amount: pack.amount, label: pack.label, credits: pack.credits },
  });
}
