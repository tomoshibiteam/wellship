/**
 * Gemini Menu Generator
 * 
 * Implements menu generation using Google Gemini API (existing implementation)
 */

import { generateWithGeminiJSON } from '../gemini';
import { buildMenuGenerationPrompt, validateMenuResponse, fixInvalidRecipeIds, AIGeneratedMenu } from '../prompts/menu';
import type { MenuGenerator, MenuGenInput, MenuGenOutput, MenuGenerationError, RecipeInfo } from './types';
import { Recipe } from '@prisma/client';

export class GeminiMenuGenerator implements MenuGenerator {
    async generate(input: MenuGenInput): Promise<MenuGenOutput> {
        try {
            // Build prompt using existing logic
            const prompt = buildMenuGenerationPrompt({
                recipes: [] as RecipeInfo[], // Will be populated from database
                days: input.days,
                crewCount: input.crewCount,
                dailyBudget: input.budgetPerPersonPerDay,
                minBudgetUsagePercent: input.minBudgetUsagePercent,
                policy: {
                    dailyCalorieTarget: 2200,
                    dailyProteinTarget: 70,
                    dailySaltMax: 8,
                },
                startDate: input.startDate,
                constraints: {
                    excludeIngredients: input.bannedIngredients,
                    season: input.season,
                    dayRules: input.weekdayRules,
                    maxCookingTimeMinutes: input.cookingTimeLimit,
                },
            });

            // Call Gemini API
            const response = await generateWithGeminiJSON<AIGeneratedMenu>(prompt);

            // Validate response
            const validRecipeIds = new Set<string>(); // Will be populated from database
            const isValid = validateMenuResponse(response, validRecipeIds);

            if (!isValid) {
                throw new Error('Invalid menu response from Gemini');
            }

            // Fix invalid recipe IDs if any
            const recipeMap = new Map<string, { id: string; category: string }>(); // Will be populated
            const fixedResponse = fixInvalidRecipeIds(response, validRecipeIds, recipeMap);

            return fixedResponse;
        } catch (error) {
            console.error('Gemini menu generation error:', error);
            const err = new Error(
                `Gemini menu generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            ) as MenuGenerationError;
            err.provider = 'gemini';
            err.originalError = error;
            throw err;
        }
    }
}
