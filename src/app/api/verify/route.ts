import {
  getRazorpayKeys,
  RazorpayConfigError,
  verifyPaymentSignature,
} from "../../../lib/razorpay";
import { authorizeOrder, EntitlementError } from "../../../lib/entitlements";

export const runtime = "nodejs";

/**
 * Server-side signature verification. Only a valid HMAC signature unlocks the
 * report · a client claiming success is never trusted. Razorpay Checkout
 * returns { razorpay_order_id, razorpay_payment_id, razorpay_signature } and we
 * recompute the HMAC with the key secret to confirm it.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ verified: false, error: "Request body must be valid JSON." }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const orderId = record.razorpay_order_id;
  const paymentId = record.razorpay_payment_id;
  const signature = record.razorpay_signature;
  if (
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string"
  ) {
    return Response.json({ verified: false, error: "Missing payment fields." }, { status: 400 });
  }

  let keys;
  try {
    keys = getRazorpayKeys();
  } catch (error) {
    if (error instanceof RazorpayConfigError) {
      return Response.json({ verified: false, error: "Payments are not configured yet." }, { status: 503 });
    }
    throw error;
  }

  const verified = verifyPaymentSignature({
    orderId,
    paymentId,
    signature,
    keySecret: keys.keySecret,
  });

  if (!verified) {
    console.error("[lores payment] Razorpay signature verification failed", {
      orderId,
      paymentId,
      signatureLength: signature.length,
    });
    return Response.json({ verified: false, error: "Signature verification failed." }, { status: 400 });
  }

  try {
    const reportId = authorizeOrder(orderId);
    return Response.json({ verified: true, reportId });
  } catch (error) {
    console.error("[lores payment] Verified Razorpay payment could not authorize its report", {
      orderId,
      reason: error instanceof Error ? error.message : "unknown error",
    });
    if (error instanceof EntitlementError) {
      return Response.json({ verified: false, error: "Payment verified, but we could not unlock this report. Please retry verification." }, { status: 500 });
    }
    return Response.json({ verified: false, error: "We could not record this unlock. Please retry verification." }, { status: 500 });
  }
}
