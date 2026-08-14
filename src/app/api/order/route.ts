import { isProductType, resolvePriceQuote, type ProductType } from "../../../lib/pricing";
import {
  createRazorpayOrder,
  detectCountry,
  getRazorpayKeys,
  RazorpayConfigError,
  RazorpayRequestError,
} from "../../../lib/razorpay";
import {
  assertReportAvailable,
  attachOrderToReport,
  attachPackOrder,
  EntitlementError,
} from "../../../lib/entitlements";

export const runtime = "nodejs";

/**
 * Server-side order creation. The server detects the country and picks the
 * amount from the single PRICING config for the requested product — the client
 * never sends an amount or currency, only which product ('single' | 'pack10').
 * A single is bound to the exact generated report; a pack is not tied to any
 * report (its credits are claimed to an account after payment). The publishable
 * key id is returned so the browser can open Checkout; the secret never leaves
 * the server.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const record = (body ?? {}) as { productType?: unknown; reportId?: unknown };
  const productType: ProductType = isProductType(record.productType)
    ? record.productType
    : "single";
  const reportId = typeof record.reportId === "string" ? record.reportId : "";

  // A single-report purchase must name the exact report it unlocks.
  if (productType === "single") {
    if (!reportId) {
      return Response.json({ error: "Missing report identity." }, { status: 400 });
    }
    try {
      await assertReportAvailable(reportId);
    } catch (error) {
      if (error instanceof EntitlementError) {
        return Response.json(
          { error: "This report cannot be unlocked. Please regenerate it and try again." },
          { status: 409 },
        );
      }
      return Response.json(
        { error: "We could not securely prepare checkout for this report. Please try again." },
        { status: 500 },
      );
    }
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

  const quote = resolvePriceQuote(detectCountry(request), productType);

  try {
    const order = await createRazorpayOrder({
      amount: quote.amount,
      currency: quote.currency,
      keys,
      notes:
        productType === "single"
          ? { region: quote.region, productType, reportId }
          : { region: quote.region, productType },
    });

    try {
      if (productType === "single") {
        await attachOrderToReport(order.id, reportId);
      } else {
        await attachPackOrder(order.id, { amount: quote.amount, credits: quote.credits });
      }
    } catch (error) {
      if (error instanceof EntitlementError) {
        return Response.json(
          { error: "This report cannot be unlocked. Please regenerate it and try again." },
          { status: 409 },
        );
      }
      return Response.json(
        { error: "We could not securely attach checkout to this purchase. Please try again." },
        { status: 500 },
      );
    }

    return Response.json({
      orderId: order.id,
      productType,
      amount: quote.amount,
      currency: quote.currency,
      label: quote.label,
      credits: quote.credits,
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
