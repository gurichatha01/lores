import { resolvePriceQuote } from "../../../lib/pricing";
import {
  createRazorpayOrder,
  detectCountry,
  getRazorpayKeys,
  RazorpayConfigError,
  RazorpayRequestError,
} from "../../../lib/razorpay";

export const runtime = "nodejs";

/**
 * Server-side order creation. The server detects the country, picks the price
 * from the single PRICING config, and creates the Razorpay order. The client
 * never sends an amount or currency. The publishable key id is returned so the
 * browser can open Checkout; the key secret never leaves the server.
 */
export async function POST(request: Request): Promise<Response> {
  let keys;
  try {
    keys = getRazorpayKeys();
  } catch (error) {
    if (error instanceof RazorpayConfigError) {
      return Response.json({ error: "Payments are not configured yet." }, { status: 503 });
    }
    throw error;
  }

  const quote = resolvePriceQuote(detectCountry(request));

  try {
    const order = await createRazorpayOrder({
      amount: quote.amount,
      currency: quote.currency,
      keys,
      notes: { region: quote.region },
    });
    return Response.json({
      orderId: order.id,
      amount: quote.amount,
      currency: quote.currency,
      display: quote.display,
      region: quote.region,
      keyId: keys.keyId,
    });
  } catch (error) {
    if (error instanceof RazorpayRequestError) {
      return Response.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
    }
    return Response.json({ error: "Unexpected checkout error." }, { status: 500 });
  }
}
