// 発注ステータス（DB未反映時のため独自定義）
export type OrderStatus = "DRAFT" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export type OrderItemInput = {
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    snapshotPrice: number;
    subtotal: number;
    isBonus: boolean;
};

export type CreateOrderInput = {
    vesselId: string;
    deliveryDate?: string;
    shippingNote?: string;
    items: OrderItemInput[];
};

export type OrderSummary = {
    id: string;
    orderNumber: string;
    vesselId: string;
    totalAmount: number;
    itemCount: number;
    status: OrderStatus;
    deliveryDate: string | null;
    confirmedAt: string | null;
    createdAt: string;
};

export type OrderDetail = OrderSummary & {
    items: Array<{
        id: string;
        ingredientId: string;
        ingredientName: string;
        quantity: number;
        unit: string;
        snapshotPrice: number;
        subtotal: number;
        isBonus: boolean;
    }>;
    vessel: {
        id: string;
        name: string;
        budgetPerDay: number;
    };
};

export type CheckoutResult = {
    success: boolean;
    order?: OrderSummary;
    error?: string;
};
