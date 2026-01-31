import { NextResponse } from "next/server";
import { createOrderFromProcurement, confirmOrder } from "@/app/(chef)/procurement/order-actions";
import type { ProcurementItem } from "@/app/(chef)/procurement/types";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { items, vesselId, deliveryDate, shippingNote, confirmImmediately } = body as {
            items: ProcurementItem[];
            vesselId: string;
            deliveryDate?: string;
            shippingNote?: string;
            confirmImmediately?: boolean;
        };

        if (!vesselId) {
            return NextResponse.json({ success: false, error: "vesselId is required" }, { status: 400 });
        }

        if (!items || items.length === 0) {
            return NextResponse.json({ success: false, error: "items are required" }, { status: 400 });
        }

        // 発注を作成
        const result = await createOrderFromProcurement(items, vesselId, deliveryDate, shippingNote);

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        // confirmImmediately が true の場合、即座に確定
        if (confirmImmediately && result.order) {
            const confirmResult = await confirmOrder(result.order.id);
            if (!confirmResult.success) {
                return NextResponse.json(confirmResult, { status: 400 });
            }
            return NextResponse.json(confirmResult);
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("checkout error", error);
        return NextResponse.json(
            { success: false, error: (error as Error).message || "発注処理に失敗しました" },
            { status: 500 }
        );
    }
}
