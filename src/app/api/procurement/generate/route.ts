
import { NextResponse } from "next/server";
import { generateProcurementFromLatest } from "@/app/(dashboard)/procurement/actions";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const effectiveDays = typeof body?.effectiveDays === "number" ? body.effectiveDays : undefined;
    // 最新の MenuPlan 範囲を元に集計し、effectiveDays が指定されていれば先頭からその日数に制限。
    const plan = await generateProcurementFromLatest(effectiveDays);
    if (!plan.coverage.startDate || plan.coverage.matchedDays === 0) {
      return NextResponse.json({
        plan,
        error: "献立プランがまだ作成されていません。先に『献立プラン』で献立を生成してください。",
      });
    }
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("procurement generate error", error);
    return NextResponse.json({
      plan: { items: [], totalCost: 0 },
      error: (error as Error).message ?? "調達リスト生成に失敗しました。",
    });
  }
}
