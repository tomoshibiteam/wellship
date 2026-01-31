import { NextResponse } from "next/server";
import { confirmOrder } from "@/app/(chef)/procurement/order-actions";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { orderId } = body as { orderId: string };

        if (!orderId) {
            return NextResponse.json({ success: false, error: "orderId is required" }, { status: 400 });
        }

        const result = await confirmOrder(orderId);

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("confirm error", error);
        return NextResponse.json(
            { success: false, error: (error as Error).message || "発注確定に失敗しました" },
            { status: 500 }
        );
    }
}
