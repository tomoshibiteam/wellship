"use client";

import { useState } from "react";
import type { OrderSummary } from "@/app/(chef)/procurement/order-types";

// 型拡張
type ManagerOrderSummary = OrderSummary & { vesselName: string };

interface OrdersClientProps {
    orders: ManagerOrderSummary[];
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
    DRAFT: { label: "下書き", color: "text-slate-600", bgColor: "bg-slate-100", icon: "📝" },
    CONFIRMED: { label: "発注確定", color: "text-slate-900", bgColor: "bg-slate-200", icon: "✅" },
    SHIPPED: { label: "出荷済み", color: "text-amber-700", bgColor: "bg-amber-100", icon: "🚚" },
    DELIVERED: { label: "納品完了", color: "text-slate-700", bgColor: "bg-slate-100", icon: "📦" },
    CANCELLED: { label: "キャンセル", color: "text-rose-700", bgColor: "bg-rose-100", icon: "❌" },
};

export function OrdersClient({ orders }: OrdersClientProps) {
    const [filter, setFilter] = useState<string>("ALL");

    const filteredOrders = filter === "ALL"
        ? orders
        : orders.filter(o => o.status === filter);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return date.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="space-y-4">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                <button
                    onClick={() => setFilter("ALL")}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filter === "ALL"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50"
                        }`}
                >
                    すべて ({orders.length})
                </button>
                {Object.entries(statusConfig).map(([status, config]) => {
                    const count = orders.filter(o => o.status === status).length;
                    if (count === 0) return null;
                    return (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filter === status
                                ? "bg-slate-900 text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            {config.icon} {config.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-12 text-center">
                    <div className="text-5xl mb-4">📋</div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        発注履歴がありません
                    </h3>
                    <p className="text-sm text-slate-500">
                        対象の発注データが見つかりません。
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map((order) => {
                        const statusInfo = statusConfig[order.status] || statusConfig.DRAFT;
                        return (
                            <div
                                key={order.id}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition hover:shadow-lg"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xl">{statusInfo.icon}</span>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-slate-800">
                                                        発注 #{order.orderNumber}
                                                    </h3>
                                                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                                        {order.vesselName}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    {formatDate(order.createdAt)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4 mt-3">
                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.color}`}>
                                                {statusInfo.label}
                                            </span>
                                            <span className="text-sm text-slate-600">
                                                {order.itemCount} 品目
                                            </span>
                                            {order.deliveryDate && (
                                                <span className="text-sm text-slate-600">
                                                    📅 希望納品: {formatDate(order.deliveryDate).split(" ")[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-slate-900">
                                            ¥{order.totalAmount.toLocaleString()}
                                        </div>
                                        {order.confirmedAt && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                確定: {formatDate(order.confirmedAt)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
