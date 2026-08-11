import { NextResponse } from "next/server";

import { askReport } from "@/server/askReport";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await askReport(await request.json());

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.status },
      );
    }

    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json(
      { error: "Не удалось получить ответ. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
