
import { NextResponse } from "next/server";
import { trimMenuPlanDays } from "@/app/(dashboard)/planning/actions";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const effectiveDays = Number(body?.effectiveDays ?? 0);
    if (!effectiveDays || effectiveDays < 1) {
      return NextResponse.json(
        { error: "日数は1以上を入力してください。" },
        { status: 400 },
      );
    }
    const plan = await trimMenuPlanDays(effectiveDays);
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("menu trim error", error);
    return NextResponse.json(
      { error: (error as Error).message ?? "献立の日数短縮に失敗しました。" },
      { status: 500 },
    );
  }
}
