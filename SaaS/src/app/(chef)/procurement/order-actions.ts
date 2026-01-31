"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CheckoutResult, CreateOrderInput, OrderSummary } from "./order-types";
import type { ProcurementItem } from "./types";

// 発注番号を生成（YYMMDD-XXXX形式）
function generateOrderNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `${dateStr}-${random}`;
}

/**
 * 調達リストから発注を作成
 */
export async function createOrderFromProcurement(
    items: ProcurementItem[],
    vesselId: string,
    deliveryDate?: string,
    shippingNote?: string,
): Promise<CheckoutResult> {
    const supabase = await createSupabaseServerClient();

    // 在庫ありの食材は除外し、発注量が0より大きい食材のみ対象
    const orderItems = items.filter((item) => !item.inStock && item.orderAmount > 0);

    if (orderItems.length === 0) {
        return {
            success: false,
            error: "発注対象の食材がありません。在庫チェックと発注量を確認してください。",
        };
    }

    // 合計金額を計算
    const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const orderNumber = generateOrderNumber();

    // トランザクション的に Order と OrderItem を作成
    // Supabase では RPC を使うか、個別に insert するしかないので、まず Order を作成
    const { data: order, error: orderError } = await supabase
        .from("Order")
        .insert({
            orderNumber,
            vesselId,
            totalAmount: Math.round(totalAmount),
            itemCount: orderItems.length,
            status: "DRAFT",
            deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : null,
            shippingNote: shippingNote || null,
        })
        .select("id, orderNumber, vesselId, totalAmount, itemCount, status, deliveryDate, confirmedAt, createdAt")
        .single();

    if (orderError || !order) {
        console.error("Failed to create order", orderError);
        return {
            success: false,
            error: `発注の作成に失敗しました: ${orderError?.message || "不明なエラー"}`,
        };
    }

    // OrderItem を一括作成
    const orderItemsData = orderItems.map((item) => ({
        orderId: order.id,
        ingredientId: item.ingredientId,
        quantity: item.orderAmount,
        unit: item.unit,
        snapshotPrice: Math.round(item.unitCost),
        subtotal: Math.round(item.subtotal),
        isBonus: false, // 後で Ingredient から取得して設定
    }));

    const { error: itemsError } = await supabase.from("OrderItem").insert(orderItemsData);

    if (itemsError) {
        console.error("Failed to create order items", itemsError);
        // Order を削除（ロールバック）
        await supabase.from("Order").delete().eq("id", order.id);
        return {
            success: false,
            error: `発注明細の作成に失敗しました: ${itemsError.message}`,
        };
    }

    return {
        success: true,
        order: {
            id: order.id,
            orderNumber: order.orderNumber,
            vesselId: order.vesselId,
            totalAmount: order.totalAmount,
            itemCount: order.itemCount,
            status: order.status,
            deliveryDate: order.deliveryDate,
            confirmedAt: order.confirmedAt,
            createdAt: order.createdAt,
        },
    };
}

/**
 * 発注を確定（DRAFT → CONFIRMED）
 */
export async function confirmOrder(orderId: string): Promise<CheckoutResult> {
    const supabase = await createSupabaseServerClient();

    const { data: order, error: orderError } = await supabase
        .from("Order")
        .update({
            status: "CONFIRMED",
            confirmedAt: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "DRAFT") // DRAFT状態のみ確定可能
        .select("id, orderNumber, vesselId, totalAmount, itemCount, status, deliveryDate, confirmedAt, createdAt")
        .single();

    if (orderError || !order) {
        console.error("Failed to confirm order", orderError);
        return {
            success: false,
            error: orderError?.message || "発注の確定に失敗しました",
        };
    }

    return {
        success: true,
        order: {
            id: order.id,
            orderNumber: order.orderNumber,
            vesselId: order.vesselId,
            totalAmount: order.totalAmount,
            itemCount: order.itemCount,
            status: order.status,
            deliveryDate: order.deliveryDate,
            confirmedAt: order.confirmedAt,
            createdAt: order.createdAt,
        },
    };
}

/**
 * 発注一覧を取得
 */
export async function getOrders(vesselId: string): Promise<OrderSummary[]> {
    const supabase = await createSupabaseServerClient();

    const { data: orders, error } = await supabase
        .from("Order")
        .select("id, orderNumber, vesselId, totalAmount, itemCount, status, deliveryDate, confirmedAt, createdAt")
        .eq("vesselId", vesselId)
        .order("createdAt", { ascending: false })
        .limit(50);

    if (error) {
        console.error("Failed to get orders", error);
        return [];
    }

    return orders || [];
    return orders || [];
}

/**
 * 全船舶の発注一覧を取得（Manager向け）
 */
export async function getAllOrders(): Promise<(OrderSummary & { vesselName: string })[]> {
    const supabase = await createSupabaseServerClient();

    const { data: orders, error } = await supabase
        .from("Order")
        .select("id, orderNumber, vesselId, totalAmount, itemCount, status, deliveryDate, confirmedAt, createdAt, Vessel(name)")
        .order("createdAt", { ascending: false })
        .limit(100);

    if (error) {
        console.error("Failed to get all orders", JSON.stringify(error, null, 2));
        // If Order table doesn't exist yet, return empty array instead of crashing
        if (error.code === 'PGRST205') {
            console.warn("Order table not found in database. Please run database migrations.");
            return [];
        }
        return [];
    }

    if (!orders) return [];

    return orders.map((order: any) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        vesselId: order.vesselId,
        totalAmount: order.totalAmount,
        itemCount: order.itemCount,
        status: order.status,
        deliveryDate: order.deliveryDate,
        confirmedAt: order.confirmedAt,
        createdAt: order.createdAt,
        // PostgREST may return 'Vessel' or 'vessel' depending on configuration
        vesselName: order.Vessel?.name ?? order.vessel?.name ?? "Unknown Vessel",
    }));
}

/**
 * 発注をキャンセル
 */
export async function cancelOrder(orderId: string): Promise<CheckoutResult> {
    const supabase = await createSupabaseServerClient();

    const { data: order, error: orderError } = await supabase
        .from("Order")
        .update({
            status: "CANCELLED",
        })
        .eq("id", orderId)
        .in("status", ["DRAFT", "CONFIRMED"]) // DRAFT or CONFIRMED のみキャンセル可能
        .select("id, orderNumber, vesselId, totalAmount, itemCount, status, deliveryDate, confirmedAt, createdAt")
        .single();

    if (orderError || !order) {
        console.error("Failed to cancel order", orderError);
        return {
            success: false,
            error: orderError?.message || "発注のキャンセルに失敗しました",
        };
    }

    return {
        success: true,
        order: {
            id: order.id,
            orderNumber: order.orderNumber,
            vesselId: order.vesselId,
            totalAmount: order.totalAmount,
            itemCount: order.itemCount,
            status: order.status,
            deliveryDate: order.deliveryDate,
            confirmedAt: order.confirmedAt,
            createdAt: order.createdAt,
        },
    };
}

/**
 * 現在のDRAFT発注を取得（なければ null）
 */
export async function getCurrentDraftOrder(vesselId: string): Promise<OrderSummary | null> {
    const supabase = await createSupabaseServerClient();

    const { data: order, error } = await supabase
        .from("Order")
        .select("id, orderNumber, vesselId, totalAmount, itemCount, status, deliveryDate, confirmedAt, createdAt")
        .eq("vesselId", vesselId)
        .eq("status", "DRAFT")
        .order("createdAt", { ascending: false })
        .limit(1)
        .single();

    if (error || !order) {
        return null;
    }

    return order;
}
