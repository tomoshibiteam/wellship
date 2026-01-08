/**
 * Dify Menu Generator
 * 
 * Implements menu generation using Dify Workflow API
 */

import type { MenuGenerator, MenuGenInput, MenuGenOutput, MenuGenerationError, MenuValidationError } from './types';

export class DifyMenuGenerator implements MenuGenerator {
    private apiKey: string;
    private workflowUrl: string;

    constructor() {
        this.apiKey = process.env.DIFY_API_KEY || '';
        this.workflowUrl = process.env.DIFY_WORKFLOW_URL || '';

        if (!this.apiKey) {
            throw new Error('DIFY_API_KEY is not set');
        }
        if (!this.workflowUrl) {
            throw new Error('DIFY_WORKFLOW_URL is not set');
        }
    }

    async generate(input: MenuGenInput): Promise<MenuGenOutput> {
        try {
            // Call Dify Workflow API
            const response = await fetch(this.workflowUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: {
                        // Map input to Dify workflow parameters
                        crew_count: input.crewCount,
                        days: input.days,
                        budget_per_person_per_day: input.budgetPerPersonPerDay,
                        min_budget_usage_percent: input.minBudgetUsagePercent,
                        start_date: input.startDate,
                        season: input.season || '',
                        cooking_time_limit: input.cookingTimeLimit || 0,
                        banned_ingredients: input.bannedIngredients?.join(',') || '',
                        weekday_rules: JSON.stringify(input.weekdayRules || {}),
                        allowed_recipe_ids: input.allowedRecipeIds?.join(',') || '',
                    },
                    response_mode: 'blocking', // Wait for completion
                    user: 'wellship-server', // User identifier
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Dify API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            // Extract output from Dify response
            // Dify response structure: { data: { outputs: { ... } } }
            const output = data.data?.outputs?.menu || data.outputs?.menu;

            if (!output) {
                throw new Error('No menu output from Dify workflow');
            }

            // Validate and parse output
            const parsedOutput = this.parseAndValidate(output);

            return parsedOutput;
        } catch (error) {
            console.error('Dify menu generation error:', error);
            const err = new Error(
                `Dify menu generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            ) as MenuGenerationError;
            err.provider = 'dify';
            err.originalError = error;
            throw err;
        }
    }

    /**
     * Parse and validate Dify output
     */
    private parseAndValidate(output: unknown): MenuGenOutput {
        // If output is a string, try to parse as JSON
        let data: unknown = output;
        if (typeof output === 'string') {
            try {
                data = JSON.parse(output);
            } catch {
                throw new Error('Dify output is not valid JSON');
            }
        }

        // Validate structure
        if (!data || typeof data !== 'object') {
            const err = new Error('Dify output is not an object') as MenuValidationError;
            err.invalidData = data;
            throw err;
        }

        const menu = data as { days?: unknown };

        if (!Array.isArray(menu.days)) {
            const err = new Error('Dify output missing "days" array') as MenuValidationError;
            err.invalidData = data;
            throw err;
        }

        // Validate each day
        for (const day of menu.days) {
            if (
                !day ||
                typeof day !== 'object' ||
                !('date' in day) ||
                !('dayLabel' in day) ||
                !('breakfast' in day) ||
                !('lunch' in day) ||
                !('dinner' in day)
            ) {
                const err = new Error('Invalid day structure in Dify output') as MenuValidationError;
                err.invalidData = day;
                throw err;
            }

            // Validate meal arrays
            const dayObj = day as MenuGenOutput['days'][0];
            if (
                !Array.isArray(dayObj.breakfast) ||
                !Array.isArray(dayObj.lunch) ||
                !Array.isArray(dayObj.dinner)
            ) {
                const err = new Error('Invalid meal arrays in Dify output') as MenuValidationError;
                err.invalidData = day;
                throw err;
            }
        }

        return menu as MenuGenOutput;
    }

    /**
     * Helper: Resolve recipe names to IDs (if Dify returns names instead of IDs)
     * This can be called from the actions layer if needed
     */
    static async resolveRecipeNames(
        menu: MenuGenOutput,
        recipeMap: Map<string, string> // name -> id mapping
    ): Promise<MenuGenOutput> {
        return {
            days: menu.days.map(day => ({
                ...day,
                breakfast: day.breakfast.map(name => recipeMap.get(name) || name),
                lunch: day.lunch.map(name => recipeMap.get(name) || name),
                dinner: day.dinner.map(name => recipeMap.get(name) || name),
            })),
        };
    }
}
