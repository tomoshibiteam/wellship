import type { Ingredient } from "@prisma/client";

export type ProcurementRequest = {
  startDate: string;
  days: number;
  effectiveDays?: number;
};

export type ProcurementItem = {
  ingredientId: string;
  name: string;
  unit: string;
  storageType: Ingredient["storageType"];
  plannedAmount: number;
  orderAmount: number;
  inStock: boolean;
  unitCost: number;
  subtotal: number;
  // 商社プラットフォーム追加フィールド
  isBonus: boolean; // ロス食材（Boost食材）フラグ
  price: number;    // 標準単価（円） (後方互換用、matchedProductがあればそちら優先)

  // マッチングされたサプライヤー商品
  matchedProduct?: {
    id: string;
    name: string;
    supplierName: string;
    price: number;
    unit: string;
  } | null;
};

export type ProcurementResult = {
  items: ProcurementItem[];
  totalCost: number;
  coverage: {
    requestedDays: number;
    effectiveDays: number;
    matchedDays: number;
    matchedDates: string[];
    startDate: string | null;
    endDate: string | null;
    crewCount: number;
    budgetPerPerson: number;
  };
};

export type DefaultStartDate = {
  startDate: string | null;
  hasPlans: boolean;
  plannedDays: number;
};
