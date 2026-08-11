import { describe, expect, it } from "vitest";

import { buildReportIndex } from "@/entities/report";
import type { DataSource } from "@/entities/report";
import { salesFixture } from "@/test/fixtures";

describe("buildReportIndex", () => {
  it("creates schema and addressable row chunks", () => {
    const index = buildReportIndex(salesFixture);

    expect(index.chunks).toHaveLength(salesFixture.rows.length + 1);
    expect(index.chunks[0]).toMatchObject({
      id: "schema",
      kind: "schema",
    });
    expect(index.chunks[1]).toMatchObject({
      id: "row-2",
      kind: "row",
      meta: { rowStart: 2, rowEnd: 2 },
    });
    expect(index.chunks[1].text).toContain("Товар: Куртка Urban");
  });

  it("splits long text with overlapping line ranges", () => {
    const content = Array.from(
      { length: 24 },
      (_, index) =>
        `Строка ${index + 1}: подробный фрагмент недельного отчёта о продажах и работе команды.`,
    ).join("\n");
    const source: DataSource = {
      name: "weekly-report.txt",
      kind: "text",
      content,
      headers: [],
      rows: [],
      stats: {
        rows: 24,
        columns: 0,
        characters: content.length,
      },
    };

    const chunks = buildReportIndex(source).chunks.filter(
      (chunk) => chunk.kind === "text",
    );

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[1].meta.lineStart).toBeLessThanOrEqual(
      chunks[0].meta.lineEnd!,
    );
    expect(chunks.every((chunk) => chunk.text.length <= 800)).toBe(true);
  });
});
