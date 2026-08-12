import { afterEach, describe, expect, it, vi } from "vitest";

import { invokeReportRag } from "@/server/rag";
import { buildReportIndex } from "@/entities/report";
import { marketingFixture } from "@/test/fixtures";

describe("reportRagGraph", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to deterministic math when the model is unavailable", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");

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
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");

    const result = await invokeReportRag({
      source: marketingFixture,
      index: buildReportIndex(marketingFixture),
      question: "Привет! Как дела?",
      history: [],
    });

    expect(result.answer).toContain("Привет");
    expect(result.citations).toEqual([]);
  });

  it("answers least-bought car from data when AI is offline", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");

    const carsFixture = {
      name: "cars.csv",
      kind: "csv" as const,
      content: "x",
      headers: ["Дата", "Марка", "Модель", "Статус", "Цена"],
      rows: [
        ["2026-01-01", "Toyota", "Camry", "Продан", 1_200_000],
        ["2026-01-02", "Toyota", "RAV4", "Продан", 1_500_000],
        ["2026-01-03", "BMW", "X5", "Возврат", 3_000_000],
        ["2026-01-04", "Toyota", "Camry", "Продан", 1_100_000],
      ],
      stats: { rows: 4, columns: 5, characters: 1 },
    };

    const result = await invokeReportRag({
      source: carsFixture,
      index: buildReportIndex(carsFixture),
      question: "Какую машину покупали меньше всего?",
      history: [],
    });

    expect(result.answer).toMatch(/Марка|Модель|BMW/);
    expect(result.answer).not.toMatch(/AI-модель недоступна|Статус|Продан/);
  });
});
