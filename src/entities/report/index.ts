export type {
  CellValue,
  DataSource,
  ReportChunk,
  ReportIndex,
} from "./model/types";
export { sampleData, sampleDataFootnote } from "./model/sampleData";
export { buildReportIndex } from "./lib/reportIndex";
export { retrieveChunks, rankChunks } from "./lib/retrieve";
export { answerDeterministically } from "./lib/queryEngine";
export { analyzeLocally, answerLocally, withReportOverview, buildLocalNarrative } from "./lib/localAnalysis";
export { sourceKindLabel } from "./lib/sourceKindLabel";
