import "server-only";

import type { DashboardAnalysis } from "@/entities/analysis";
import { analyzeLocally } from "@/entities/report";
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
    let analysis: DashboardAnalysis | null = null;

    try {
      analysis = await generateAIAnalysis(parsed.data);
    } catch (error) {
      console.error("AI analysis failed, using local fallback:", error);
    }

    return ok({
      analysis: analysis ?? analyzeLocally(parsed.data),
    });
  } catch {
    return fail(500, "Не удалось запустить анализ. Попробуйте ещё раз.");
  }
}
