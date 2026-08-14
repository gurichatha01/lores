import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as checkAccess } from "../src/app/api/report-access/route";
import { POST as getReport } from "../src/app/api/report/route";
import { POST as verifyPayment } from "../src/app/api/verify/route";
import {
  attachOrderToReport,
  authorizeOrder,
  isReportAuthorized,
  issueReportId,
  resetEntitlementsForTests,
  storeGeneratedReport,
} from "../src/lib/entitlements";
import type { ReportSessionData } from "../src/lib/types";

afterEach(() => {
  resetEntitlementsForTests();
  vi.unstubAllEnvs();
});

describe("per-report entitlements", () => {
  it("authorizes exactly the report bound to a verified payment", async () => {
    const firstReport = issueReportId();
    const secondReport = issueReportId();
    attachOrderToReport("order_for_first", firstReport);

    expect(authorizeOrder("order_for_first")).toBe(firstReport);
    expect(isReportAuthorized(firstReport)).toBe(true);
    expect(isReportAuthorized(secondReport)).toBe(false);

    const firstAccess = await checkAccess(jsonRequest({ reportId: firstReport }));
    const secondAccess = await checkAccess(jsonRequest({ reportId: secondReport }));
    await expect(firstAccess.json()).resolves.toEqual({ authorized: true });
    await expect(secondAccess.json()).resolves.toEqual({ authorized: false });
  });

  it("defaults to locked for missing, unknown, and unbound identities", async () => {
    const unbound = issueReportId();
    expect(isReportAuthorized(unbound)).toBe(false);

    const missing = await checkAccess(jsonRequest({}));
    const unknown = await checkAccess(jsonRequest({ reportId: "not-a-real-report" }));
    expect(missing.status).toBe(400);
    await expect(unknown.json()).resolves.toEqual({ authorized: false });
  });

  it("records an entitlement only after a valid payment signature", async () => {
    const reportId = issueReportId();
    const orderId = "order_bound_to_one_report";
    const paymentId = "pay_valid";
    attachOrderToReport(orderId, reportId);
    vi.stubEnv("RAZORPAY_KEY_ID", "test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_secret");
    const signature = createHmac("sha256", "test_secret")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const response = await verifyPayment(
      jsonRequest({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ verified: true, reportId });
    expect(isReportAuthorized(reportId)).toBe(true);
  });

  it("never unlocks an order with an invalid signature", async () => {
    const reportId = issueReportId();
    attachOrderToReport("order_invalid_signature", reportId);
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
    expect(isReportAuthorized(reportId)).toBe(false);
  });

  it("does not return a full report until its exact order is authorized", async () => {
    const reportId = issueReportId();
    const storedReport = { reportId, mode: "sweetheart" } as ReportSessionData;
    storeGeneratedReport(reportId, storedReport);

    const locked = await getReport(jsonRequest({ reportId }));
    expect(locked.status).toBe(403);

    attachOrderToReport("order_for_stored_report", reportId);
    authorizeOrder("order_for_stored_report");
    const unlocked = await getReport(jsonRequest({ reportId }));
    expect(unlocked.status).toBe(200);
    await expect(unlocked.json()).resolves.toEqual({ report: storedReport });
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/report-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
