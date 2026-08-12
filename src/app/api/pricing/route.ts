import { resolvePriceQuote } from "../../../lib/pricing";
import { detectCountry } from "../../../lib/razorpay";

export const runtime = "nodejs";

/**
 * Quote-only endpoint so the teaser can display the correct price without
 * creating an order. The price is decided server-side from geo headers; the
 * client never computes or sends an amount.
 */
export function GET(request: Request): Response {
  const quote = resolvePriceQuote(detectCountry(request));
  return Response.json({
    currency: quote.currency,
    amount: quote.amount,
    display: quote.display,
    region: quote.region,
    international: quote.international,
  });
}
