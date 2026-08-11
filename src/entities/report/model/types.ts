import type { CellValue } from "@/shared/types";

export type { CellValue };

export type DataSourceKind = "csv" | "xlsx" | "text" | "demo";

export interface DataSource {
  name: string;
  kind: DataSourceKind;
  content: string;
  headers: string[];
  rows: CellValue[][];
  stats: {
    rows: number;
    columns: number;
    characters: number;
  };
}

export type ReportChunkKind = "schema" | "row" | "text";

export interface ReportChunk {
  id: string;
  kind: ReportChunkKind;
  text: string;
  meta: {
    label: string;
    rowStart?: number;
    rowEnd?: number;
    lineStart?: number;
    lineEnd?: number;
  };
}

export interface ReportIndex {
  sourceName: string;
  schema: string;
  chunks: ReportChunk[];
}
