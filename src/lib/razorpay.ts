import crypto from "node:crypto";

/**
 * Server-only Razorpay helpers. The key secret lives here and never crosses
 * the network to the client. Import this only from route handlers.
 */

export class RazorpayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayConfigError";
  }
}

export class RazorpayRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayRequestError";
  }
}

export interface RazorpayKeys {
  keyId: string;
  keySecret: string;
}

export function getRazorpayKeys(): RazorpayKeys {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new RazorpayConfigError("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured.");
  }
  return { keyId, keySecret };
}

/**
 * Best-effort country detection from platform geo headers. Never trusts a
 * client-supplied value — pricing is decided from these headers only. A
 * DEV_COUNTRY_OVERRIDE env is honored for local testing where no geo header
 * exists (both prices can then be exercised without a VPN).
 */
export function detectCountry(request: Request): string | null {
  const devOverride = process.env.DEV_COUNTRY_OVERRIDE?.trim();
  if (devOverride) {
    return devOverride.toUpperCase();
  }
  const headers = request.headers;
  const candidate =
    headers.get("x-vercel-ip-country") ??
    headers.get("cf-ipcountry") ??
    headers.get("x-country-code") ??
    null;
  const normalized = candidate?.trim().toUpperCase();
  return normalized && normalized !== "XX" ? normalized : null;
}

export interface CreateOrderParams {
  amount: number;
  currency: string;
  keys: RazorpayKeys;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createRazorpayOrder({
  amount,
  currency,
  keys,
  receipt,
  notes,
}: CreateOrderParams): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt: receipt ?? `lore_${Date.now()}`,
      payment_capture: 1,
      notes,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new RazorpayRequestError(`Razorpay order creation failed with status ${response.status}.`);
  }

  const order = (await response.json()) as Partial<RazorpayOrder>;
  if (!order || typeof order.id !== "string") {
    throw new RazorpayRequestError("Razorpay order response was malformed.");
  }
  return {
    id: order.id,
    amount: typeof order.amount === "number" ? order.amount : amount,
    currency: typeof order.currency === "string" ? order.currency : currency,
    status: typeof order.status === "string" ? order.status : "created",
  };
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}

/**
 * Verifies the Razorpay Checkout signature: HMAC-SHA256 of
 * `${orderId}|${paymentId}` keyed with the key secret must equal the returned
 * signature. This is the ONLY thing that unlocks — a client saying "I paid"
 * means nothing without this passing. Constant-time comparison.
 */
export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
  keySecret,
}: VerifySignatureParams): boolean {
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
