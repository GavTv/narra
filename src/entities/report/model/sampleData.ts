import type { DataSource } from "./types";

const headers = [
  "День",
  "Создано",
  "Закрыто",
  "На ревью",
  "Cycle time, ч",
  "Баги",
];

const rows = [
  ["Понедельник", 24, 18, 8, 31, 4],
  ["Вторник", 32, 17, 19, 46, 9],
  ["Среда", 27, 23, 15, 39, 6],
  ["Четверг", 21, 25, 9, 29, 3],
  ["Пятница", 18, 22, 7, 27, 2],
];

const content = [
  headers.join(";"),
  ...rows.map((row) => row.join(";")),
].join("\n");

export const sampleData: DataSource = {
  name: "Jira — неделя 32",
  kind: "demo",
  content,
  headers,
  rows,
  stats: {
    rows: rows.length,
    columns: headers.length,
    characters: content.length,
  },
};
