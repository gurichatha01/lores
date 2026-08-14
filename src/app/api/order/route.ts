import { resolvePriceQuote } from "../../../lib/pricing";
import {
  createRazorpayOrder,
  detectCountry,
  getRazorpayKeys,
  RazorpayConfigError,
  RazorpayRequestError,
} from "../../../lib/razorpay";
import { assertReportAvailable, attachOrderToReport, EntitlementError } from "../../../lib/entitlements";

export const runtime = "nodejs";

/**
 * Server-side order creation. The server detects the country, picks the price
 * from the single PRICING config, and creates the Razorpay order. The client
 * never sends an amount or currency. The publishable key id is returned so the
 * browser can open Checkout; the key secret never leaves the server.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const reportId = (body as { reportId?: unknown } | null)?.reportId;
  if (typeof reportId !== "string" || !reportId) {
    return Response.json({ error: "Missing report identity." }, { status: 400 });
  }
  try {
    assertReportAvailable(reportId);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json({ error: "This report cannot be unlocked. Please regenerate it and try again." }, { status: 409 });
    }
    return Response.json({ error: "We could not securely prepare checkout for this report. Please try again." }, { status: 500 });
  }
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
      notes: { region: quote.region, reportId },
    });
    try {
      attachOrderToReport(order.id, reportId);
    } catch (error) {
      if (error instanceof EntitlementError) {
        return Response.json({ error: "This report cannot be unlocked. Please regenerate it and try again." }, { status: 409 });
      }
      return Response.json({ error: "We could not securely attach checkout to this report. Please try again." }, { status: 500 });
    }
    return Response.json({
      orderId: order.id,
      amount: quote.amount,
      currency: quote.currency,
      label: quote.label,
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
