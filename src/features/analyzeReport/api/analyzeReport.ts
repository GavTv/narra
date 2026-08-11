import type { DashboardAnalysis } from "@/entities/analysis";
import type { DataSource } from "@/entities/report";
import { postJson } from "@/shared/lib/http";

export async function analyzeReport(
  source: DataSource,
): Promise<DashboardAnalysis> {
  const body = await postJson<{ analysis?: DashboardAnalysis }>(
    "/api/analyze",
    { source },
    "Сервис временно недоступен.",
  );

  if (!body.analysis) {
    throw new Error("Сервис временно недоступен.");
  }

  return body.analysis;
}
