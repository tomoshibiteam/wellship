/**
 * AI Menu Generator Types
 * 
 * Common interfaces for menu generation across different AI providers.
 */

/**
 * Input parameters for menu generation
 */
export interface MenuGenInput {
    // Basic parameters
    crewCount: number;
    days: number;
    budgetPerPersonPerDay: number;
    minBudgetUsagePercent: number; // 90% by default
    startDate: string; // ISO format: YYYY-MM-DD

    // Constraints
    season?: 'spring' | 'summer' | 'autumn' | 'winter';
    cookingTimeLimit?: number; // Maximum cooking time in minutes
    bannedIngredients?: string[]; // Ingredients to exclude (allergies etc.)
    weekdayRules?: Record<string, string>; // Special rules per weekday

    // Advanced constraints (for sourcing feature)
    allowedRecipeIds?: string[]; // When sourcing constraints are enabled
}

/**
 * Output format from AI menu generation
 * Must match RecipeID format from database
 */
export interface MenuGenOutput {
    days: Array<{
        date: string; // ISO format: YYYY-MM-DD
        dayLabel: string; // e.g., "月曜日"
        breakfast: string[]; // Array of Recipe IDs
        lunch: string[];
        dinner: string[];
    }>;
}

/**
 * Menu Generator Interface
 * All AI providers must implement this interface
 */
export interface MenuGenerator {
    /**
     * Generate menu plan based on input parameters
     * 
     * @param input Menu generation parameters
     * @returns Menu plan with recipe IDs for each meal
     * @throws Error if generation fails
     */
    generate(input: MenuGenInput): Promise<MenuGenOutput>;
}

/**
 * Helper type for recipe information used in generation
 */
export interface RecipeInfo {
    id: string;
    name: string;
    category: 'main' | 'side' | 'soup' | 'dessert';
    calories: number;
    protein: number;
    salt: number;
    costPerServing: number;
}

/**
 * Error types for menu generation
 */
export class MenuGenerationError extends Error {
    constructor(
        message: string,
        public provider: string,
        public originalError?: unknown
    ) {
        super(message);
        this.name = 'MenuGenerationError';
    }
}

export class MenuValidationError extends Error {
    constructor(message: string, public invalidData?: unknown) {
        super(message);
        this.name = 'MenuValidationError';
    }
}
