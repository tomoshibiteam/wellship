
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      ingredientId,
      startDate,
      endDate,
      plannedAmount,
      orderAmount,
      inStock,
      unitPrice,
    } = body;

    if (!ingredientId || !startDate || !endDate) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const vesselId = user.vesselIds?.[0];
    if (!vesselId) {
      return NextResponse.json({ error: "担当船舶が設定されていません" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("ProcurementAdjustment")
      .upsert(
        {
          ingredientId,
          vesselId,
          startDate,
          endDate,
          plannedAmount,
          orderAmount,
          inStock: Boolean(inStock),
          unitPrice,
        },
        { onConflict: "ingredientId,startDate,endDate" },
      );

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("adjustment save error", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
