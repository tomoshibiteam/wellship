
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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

    await prisma.procurementAdjustment.upsert({
      where: {
        ingredientId_startDate_endDate: {
          ingredientId,
          startDate,
          endDate,
        },
      },
      update: {
        plannedAmount,
        orderAmount,
        inStock,
        unitPrice,
      },
      create: {
        ingredientId,
        startDate,
        endDate,
        plannedAmount,
        orderAmount,
        inStock: Boolean(inStock),
        unitPrice,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("adjustment save error", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
