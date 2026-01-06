
import { NextResponse } from "next/server";
import { generateMenuPlan } from "@/app/(dashboard)/planning/actions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = await generateMenuPlan(body);
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("generate error", error);
    return NextResponse.json({ error: "Failed to generate menu plan" }, { status: 500 });
  }
}
