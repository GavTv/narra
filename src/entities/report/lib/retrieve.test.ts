import { describe, expect, it } from "vitest";

import { buildReportIndex } from "@/entities/report";
import { rankChunks, retrieveChunks } from "@/entities/report";
import type { DataSource } from "@/entities/report";
import { salesFixture } from "@/test/fixtures";

describe("retrieveChunks", () => {
  it("returns the matching table row with the schema", () => {
    const retrieved = retrieveChunks(
      buildReportIndex(salesFixture),
      "Что было с товаром Кепка Street?",
      4,
    );

    expect(retrieved[0].id).toBe("schema");
    expect(retrieved[1].id).toBe("row-4");
    expect(retrieved[1].text).toContain("Кепка Street");
  });

  it("ranks the relevant narrative fragment above unrelated text", () => {
    const content = [
      "Команда завершила планирование следующего спринта.",
      "Во вторник конверсия рекламной кампании выросла до 8 процентов.",
      "Служба поддержки обновила базу знаний.",
    ].join("\n\n");
    const source: DataSource = {
      name: "report.txt",
      kind: "text",
      content,
      headers: [],
      rows: [],
      stats: { rows: 3, columns: 0, characters: content.length },
    };

    const ranked = rankChunks(
      buildReportIndex(source),
      "Как изменилась конверсия рекламы во вторник?",
    );

    expect(ranked[0].chunk.text).toContain("конверсия рекламной кампании");
  });
});
