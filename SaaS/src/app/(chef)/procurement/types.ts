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
