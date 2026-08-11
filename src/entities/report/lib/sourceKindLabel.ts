import type { DataSourceKind } from "../model/types";

export function sourceKindLabel(kind: DataSourceKind) {
  const labels: Record<DataSourceKind, string> = {
    csv: "CSV",
    xlsx: "Excel",
    text: "Текст",
    demo: "Демо",
  };

  return labels[kind];
}
