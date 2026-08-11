import { NextResponse } from "next/server";

import { analyzeReport } from "@/server/analyzeReport";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await analyzeReport(await request.json());

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.status },
      );
    }

    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json(
      { error: "Не удалось запустить анализ. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
