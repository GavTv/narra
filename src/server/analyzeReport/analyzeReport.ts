import "server-only";

import type { DashboardAnalysis } from "@/entities/analysis";
import { analyzeLocally, withReportOverview } from "@/entities/report";
import { generateAIAnalysis } from "@/server/ai";
import { fail, ok, type AppResult } from "@/shared/lib/result";
import { dataSourceSchema } from "@/shared/lib/validation";

export type AnalyzeReportDto = {
  analysis: DashboardAnalysis;
};

export async function analyzeReport(
  payload: unknown,
): Promise<AppResult<AnalyzeReportDto>> {
  const parsed = dataSourceSchema.safeParse(
    payload && typeof payload === "object" && "source" in payload
      ? (payload as { source: unknown }).source
      : payload,
  );

  if (!parsed.success) {
    return fail(
      400,
      "Не удалось прочитать данные. Проверьте формат и попробуйте снова.",
    );
  }

  try {
    const hasTable =
      parsed.data.headers.length > 0 && parsed.data.rows.length > 0;

    // Text mode: Q&A only — skip AI dashboard charts (they invent noise without a table).
    if (!hasTable) {
      return ok({
        analysis: withReportOverview(
          parsed.data,
          analyzeLocally(parsed.data),
        ),
      });
    }

    let analysis: DashboardAnalysis | null = null;

    try {
      analysis = await generateAIAnalysis(parsed.data);
    } catch (error) {
      console.error("AI analysis failed, using local fallback:", error);
    }

    const resolved = analysis ?? analyzeLocally(parsed.data);

    return ok({
      analysis: withReportOverview(parsed.data, resolved),
    });
  } catch {
    return fail(500, "Не удалось запустить анализ. Попробуйте ещё раз.");
  }
}
