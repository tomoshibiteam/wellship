
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("ProcurementAdjustment")
      .upsert(
        {
          ingredientId,
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
