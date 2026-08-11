import { describe, expect, it } from "vitest";

import { textToSource, tryParseTextTable } from "./parseFile";

describe("textToSource", () => {
  it("parses a pasted sales table and names it from columns", () => {
    const source = textToSource(
      [
        "Дата;Товар;Регион;Выручка;Заказы",
        "2026-08-01;Куртка Urban;Москва;120000;12",
        "2026-08-02;Кепка Street;Казань;45000;9",
      ].join("\n"),
    );

    expect(source.kind).toBe("csv");
    expect(source.name).toBe("Продажи");
    expect(source.headers).toEqual([
      "Дата",
      "Товар",
      "Регион",
      "Выручка",
      "Заказы",
    ]);
    expect(source.rows).toHaveLength(2);
    expect(source.rows[0]?.[3]).toBe("120000");
  });

  it("keeps prose as text and infers a topic title", () => {
    const source = textToSource(
      [
        "Еженедельный отчёт магазина",
        "Выручка составила 1 240 000 рублей.",
        "Оформлено 312 заказов, средний чек вырос.",
      ].join("\n"),
    );

    expect(source.kind).toBe("text");
    expect(source.name).toBe("Продажи");
    expect(source.headers).toEqual([]);
  });

  it("does not treat plain sentences as a table", () => {
    expect(
      tryParseTextTable(
        "Выручка выросла на 18 процентов. Заказы тоже подросли за неделю.",
      ),
    ).toBeNull();
  });
});
