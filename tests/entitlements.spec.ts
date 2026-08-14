import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as checkAccess } from "../src/app/api/report-access/route";
import { POST as verifyPayment } from "../src/app/api/verify/route";
import {
  attachOrderToReport,
  authorizeOrder,
  isReportAuthorized,
  issueReportId,
  registerReport,
  resetEntitlementsForTests,
} from "../src/lib/entitlements";

afterEach(() => {
  resetEntitlementsForTests();
  vi.unstubAllEnvs();
});

describe("per-report entitlements (durable store, in-memory fallback)", () => {
  it("authorizes exactly the report bound to a verified payment", async () => {
    const firstReport = issueReportId();
    const secondReport = issueReportId();
    await registerReport(firstReport);
    await registerReport(secondReport);
    await attachOrderToReport("order_for_first", firstReport);

    expect(await authorizeOrder("order_for_first")).toBe(firstReport);
    expect(await isReportAuthorized(firstReport)).toBe(true);
    expect(await isReportAuthorized(secondReport)).toBe(false);

    const firstAccess = await checkAccess(jsonRequest({ reportId: firstReport }));
    const secondAccess = await checkAccess(jsonRequest({ reportId: secondReport }));
    await expect(firstAccess.json()).resolves.toEqual({ authorized: true });
    await expect(secondAccess.json()).resolves.toEqual({ authorized: false });
  });

  it("defaults to locked for missing, unknown, and unbound identities", async () => {
    const unbound = issueReportId();
    await registerReport(unbound);
    expect(await isReportAuthorized(unbound)).toBe(false);

    const missing = await checkAccess(jsonRequest({}));
    const unknown = await checkAccess(jsonRequest({ reportId: "not-a-real-report" }));
    expect(missing.status).toBe(400);
    await expect(unknown.json()).resolves.toEqual({ authorized: false });
  });

  it("records an entitlement only after a valid payment signature", async () => {
    const reportId = issueReportId();
    const orderId = "order_bound_to_one_report";
    const paymentId = "pay_valid";
    await registerReport(reportId);
    await attachOrderToReport(orderId, reportId);
    vi.stubEnv("RAZORPAY_KEY_ID", "test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_secret");
    const signature = createHmac("sha256", "test_secret")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const response = await verifyPayment(
      jsonRequest({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ verified: true, productType: "single", reportId });
    expect(await isReportAuthorized(reportId)).toBe(true);
  });

  it("never unlocks an order with an invalid signature", async () => {
    const reportId = issueReportId();
    await registerReport(reportId);
    await attachOrderToReport("order_invalid_signature", reportId);
    vi.stubEnv("RAZORPAY_KEY_ID", "test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_secret");

    const response = await verifyPayment(
      jsonRequest({
        razorpay_order_id: "order_invalid_signature",
        razorpay_payment_id: "pay_invalid",
        razorpay_signature: "not-a-valid-hmac",
      }),
    );

    expect(response.status).toBe(400);
    expect(await isReportAuthorized(reportId)).toBe(false);
  });

  it("keeps report access locked until the exact order is authorized", async () => {
    const reportId = issueReportId();
    await registerReport(reportId);

    const lockedBefore = await checkAccess(jsonRequest({ reportId }));
    await expect(lockedBefore.json()).resolves.toEqual({ authorized: false });

    await attachOrderToReport("order_for_report", reportId);
    await authorizeOrder("order_for_report");

    const unlockedAfter = await checkAccess(jsonRequest({ reportId }));
    await expect(unlockedAfter.json()).resolves.toEqual({ authorized: true });
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/report-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
