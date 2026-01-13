
import { NextResponse } from "next/server";
import { generateMenuPlan } from "@/app/(chef)/planning/actions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = await generateMenuPlan(body);
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("generate error", error);
    const message =
      error instanceof Error ? error.message : "献立生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
