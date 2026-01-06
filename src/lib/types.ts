import {
  LeftoverAmount,
  MealType,
  RecipeCategory,
  StorageType,
  VolumeFeeling,
} from "@prisma/client";

export type Ingredient = {
  id: string;
  name: string;
  storageType: StorageType;
  unit: string;
};

export type RecipeIngredientRef = {
  ingredientId: string;
  amount: number;
  ingredient?: Ingredient;
};

export type Recipe = {
  id: string;
  name: string;
  category: RecipeCategory;
  calories: number;
  protein: number;
  salt: number;
  costPerServing: number;
  ingredients: RecipeIngredientRef[];
};

export type MenuPlan = {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  recipeIds: string[];
  healthScore: number;
};

export type MealFeedback = {
  id: string;
  date: string;
  mealType: MealType;
  menuPlanId: string | null;
  satisfaction: 1 | 2 | 3 | 4 | 5;
  volumeFeeling: VolumeFeeling;
  leftover: LeftoverAmount;
  comment?: string;
};

export {
  LeftoverAmount,
  MealType,
  RecipeCategory,
  StorageType,
  VolumeFeeling,
};
