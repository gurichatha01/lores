import {
  generateReport,
  LlmConfigurationError,
  LlmOutputError,
  LlmRequestError,
} from "../../../lib/llm";
import { parseGenerateReportInput, ReportValidationError } from "../../../lib/reportValidation";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const input = parseGenerateReportInput(body);
    if (process.env.NODE_ENV === "development") {
      console.info("[lores receipts] API input", {
        receiptExchangeCount: input.receiptExchanges.length,
        exchangeIds: input.receiptExchanges.map((exchange) => exchange.exchangeId),
      });
    }
    const report = await generateReport(input);
    return Response.json(report);
  } catch (error) {
    if (error instanceof ReportValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof LlmConfigurationError) {
      return Response.json({ error: "Report generation is not configured." }, { status: 503 });
    }
    if (error instanceof LlmRequestError || error instanceof LlmOutputError) {
      return Response.json({ error: "Report generation failed." }, { status: 502 });
    }
    return Response.json({ error: "Unexpected report generation error." }, { status: 500 });
  }
}
