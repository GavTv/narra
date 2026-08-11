import { afterEach, describe, expect, it, vi } from "vitest";

import { invokeReportRag } from "@/server/rag";
import { buildReportIndex } from "@/entities/report";
import { marketingFixture } from "@/test/fixtures";

describe("reportRagGraph", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes deterministic calculations without a model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const result = await invokeReportRag({
      source: marketingFixture,
      index: buildReportIndex(marketingFixture),
      question: "Сколько всего расходов?",
      history: [],
    });

    expect(result.answer).toContain("210");
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it("keeps casual conversation when the model is unavailable", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const result = await invokeReportRag({
      source: marketingFixture,
      index: buildReportIndex(marketingFixture),
      question: "Привет! Как дела?",
      history: [],
    });

    expect(result.answer).toContain("Привет");
    expect(result.citations).toEqual([]);
  });
});
