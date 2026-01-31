"use client";

import { useState } from "react";
import type { OrderSummary } from "@/app/(chef)/procurement/order-types";

interface OrdersClientProps {
    orders: OrderSummary[];
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
    DRAFT: { label: "下書き", color: "text-slate-600", bgColor: "bg-slate-100", icon: "📝" },
    CONFIRMED: { label: "発注確定", color: "text-sky-600", bgColor: "bg-sky-100", icon: "✅" },
    SHIPPED: { label: "出荷済み", color: "text-amber-600", bgColor: "bg-amber-100", icon: "🚚" },
    DELIVERED: { label: "納品完了", color: "text-emerald-600", bgColor: "bg-emerald-100", icon: "📦" },
    CANCELLED: { label: "キャンセル", color: "text-rose-600", bgColor: "bg-rose-100", icon: "❌" },
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
            <div className="flex flex-wrap gap-2 rounded-xl border border-sky-100 bg-white p-2 shadow-sm">
                <button
                    onClick={() => setFilter("ALL")}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filter === "ALL"
                            ? "bg-sky-600 text-white shadow-sm"
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
                                    ? "bg-sky-600 text-white shadow-sm"
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
                        調達リストから発注を行うと、ここに履歴が表示されます。
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map((order) => {
                        const statusInfo = statusConfig[order.status] || statusConfig.DRAFT;
                        return (
                            <div
                                key={order.id}
                                className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_24px_rgba(14,94,156,0.06)] transition hover:shadow-lg"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xl">{statusInfo.icon}</span>
                                            <div>
                                                <h3 className="font-bold text-slate-800">
                                                    発注 #{order.orderNumber}
                                                </h3>
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
                                        <div className="text-2xl font-bold text-sky-700">
                                            ¥{order.totalAmount.toLocaleString()}
                                        </div>
                                        {order.confirmedAt && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                確定: {formatDate(order.confirmedAt)}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar for non-cancelled orders */}
                                {order.status !== "CANCELLED" && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                            <span>発注進捗</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {["DRAFT", "CONFIRMED", "SHIPPED", "DELIVERED"].map((step, index) => {
                                                const stepIndex = ["DRAFT", "CONFIRMED", "SHIPPED", "DELIVERED"].indexOf(order.status);
                                                const isCompleted = index <= stepIndex;
                                                const isCurrent = step === order.status;
                                                return (
                                                    <div key={step} className="flex-1 flex items-center">
                                                        <div className={`flex-1 h-2 rounded-full ${isCompleted
                                                                ? "bg-gradient-to-r from-sky-400 to-sky-600"
                                                                : "bg-slate-200"
                                                            }`} />
                                                        {index < 3 && (
                                                            <div className={`w-3 h-3 rounded-full mx-1 ${isCompleted ? "bg-sky-600" : "bg-slate-200"
                                                                }`} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                            <span>下書き</span>
                                            <span>確定</span>
                                            <span>出荷</span>
                                            <span>納品</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
