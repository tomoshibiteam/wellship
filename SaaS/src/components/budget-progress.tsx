"use client";

import { useEffect, useState } from "react";

type BudgetData = {
    totalCost: number;
    totalBudget: number;
    usagePercent: number;
    days: number;
    crewCount: number;
    budgetPerDay: number;
    isWithinBudget: boolean;
    meetsMinBudget: boolean;
};

interface BudgetProgressProps {
    vesselId?: string;
    compact?: boolean;
}

export function BudgetProgress({ vesselId, compact = false }: BudgetProgressProps) {
    const [budget, setBudget] = useState<BudgetData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBudget = async () => {
            try {
                const res = await fetch("/api/procurement/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                });
                const json = await res.json();

                if (json.plan?.coverage) {
                    const { coverage, totalCost } = json.plan;
                    const days = coverage.matchedDays ?? 1;
                    const crewCount = coverage.crewCount ?? 20;
                    const budgetPerPerson = coverage.budgetPerPerson ?? 1200;
                    const totalBudget = budgetPerPerson * crewCount * days;
                    const usagePercent = totalBudget > 0 ? Math.round((totalCost / totalBudget) * 100) : 0;
                    const minBudget = Math.floor(totalBudget * 0.9);

                    setBudget({
                        totalCost,
                        totalBudget,
                        usagePercent,
                        days,
                        crewCount,
                        budgetPerDay: budgetPerPerson,
                        isWithinBudget: totalCost <= totalBudget,
                        meetsMinBudget: totalCost >= minBudget,
                    });
                }
            } catch (err) {
                console.error("Failed to fetch budget data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchBudget();
    }, [vesselId]);

    if (loading) {
        return (
            <div className={`${compact ? "h-6" : "h-20"} animate-pulse rounded-lg bg-slate-100`} />
        );
    }

    if (!budget) {
        return null;
    }

    const getStatusColor = () => {
        if (budget.usagePercent > 100) return "rose";
        if (budget.usagePercent >= 90) return "emerald";
        return "amber";
    };

    const color = getStatusColor();

    if (compact) {
        return (
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-1.5">
                <span className="text-xs text-slate-600">予算消化</span>
                <div className="h-2 w-24 rounded-full bg-slate-200 overflow-hidden">
                    <div
                        className={`h-full rounded-full bg-${color}-500 transition-all duration-500`}
                        style={{
                            width: `${Math.min(budget.usagePercent, 100)}%`,
                            backgroundColor: color === "emerald" ? "#10b981" : color === "rose" ? "#f43f5e" : "#f59e0b"
                        }}
                    />
                </div>
                <span className={`text-xs font-bold text-${color}-600`} style={{
                    color: color === "emerald" ? "#059669" : color === "rose" ? "#e11d48" : "#d97706"
                }}>
                    {budget.usagePercent}%
                </span>
            </div>
        );
    }

    return (
        <div className={`rounded-xl border-2 p-4 ${budget.isWithinBudget && budget.meetsMinBudget
                ? "border-emerald-200 bg-emerald-50"
                : !budget.isWithinBudget
                    ? "border-rose-200 bg-rose-50"
                    : "border-amber-200 bg-amber-50"
            }`}>
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-700">
                    📊 予算消化状況
                </h4>
                <span className={`text-lg font-bold`} style={{
                    color: color === "emerald" ? "#059669" : color === "rose" ? "#e11d48" : "#d97706"
                }}>
                    {budget.usagePercent}%
                </span>
            </div>

            <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden mb-2">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${Math.min(budget.usagePercent, 100)}%`,
                        background: color === "emerald"
                            ? "linear-gradient(to right, #34d399, #10b981)"
                            : color === "rose"
                                ? "linear-gradient(to right, #fb7185, #f43f5e)"
                                : "linear-gradient(to right, #fbbf24, #f59e0b)"
                    }}
                />
            </div>

            <div className="flex justify-between text-xs text-slate-600">
                <span>
                    ¥{Math.round(budget.totalCost).toLocaleString()} / ¥{budget.totalBudget.toLocaleString()}
                </span>
                <span>
                    {budget.days}日 × {budget.crewCount}名
                </span>
            </div>

            {!budget.isWithinBudget && (
                <p className="mt-2 text-xs font-medium text-rose-600">
                    ⚠️ 予算超過しています
                </p>
            )}
            {budget.isWithinBudget && !budget.meetsMinBudget && (
                <p className="mt-2 text-xs font-medium text-amber-600">
                    ⚠️ 最低消化率（90%）に達していません
                </p>
            )}
        </div>
    );
}
