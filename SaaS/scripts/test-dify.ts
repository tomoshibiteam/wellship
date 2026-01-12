#!/usr/bin/env tsx
/**
 * Dify API Test Script
 * 
 * Tests the Dify menu generation workflow integration
 * 
 * Usage:
 *   npx tsx scripts/test-dify.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';
import { DifyMenuGenerator } from '../src/lib/ai/providers/dify';

async function main() {
    console.log('🚀 Starting Dify API test...\n');

    try {
        // ========================================================================
        // Step 1: Verify environment variables
        // ========================================================================
        console.log('📋 Step 1: Checking environment variables...');

        if (!process.env.DIFY_API_KEY) {
            throw new Error('❌ DIFY_API_KEY is not set in .env.local');
        }

        if (!process.env.DIFY_BASE_URL) {
            throw new Error('❌ DIFY_BASE_URL is not set in .env.local');
        }

        console.log('✅ Environment variables configured');
        console.log(`   API Key: ${process.env.DIFY_API_KEY.substring(0, 10)}...`);
        console.log(`   Base URL: ${process.env.DIFY_BASE_URL}\n`);

        // ========================================================================
        // Step 2: Fetch sample recipes from database
        // ========================================================================
        console.log('📋 Step 2: Fetching recipes from database...');

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            throw new Error('❌ NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in .env.local');
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            { auth: { persistSession: false } },
        );

        const { data: recipes, error: recipesError } = await supabase
            .from('Recipe')
            .select(
                'id,name,category,calories,protein,salt,costPerServing,source,status,ingredients:RecipeIngredient(amount,ingredient:Ingredient(costPerUnit))',
            )
            .eq('source', 'my')
            .eq('status', 'published')
            .limit(20);

        if (recipesError) {
            throw recipesError;
        }

        if (recipes.length === 0) {
            throw new Error('❌ No recipes found in database. Please seed the database first.');
        }

        console.log(`✅ Found ${recipes.length} recipes\n`);

        // ========================================================================
        // Step 3: Build recipe JSON for Dify
        // ========================================================================
        console.log('📋 Step 3: Building recipe data...');

        const recipeData = recipes.map((recipe) => {
            // Calculate ingredient cost
            const ingredientCost = (recipe.ingredients ?? []).reduce((sum, ri) => {
                const ingredient = Array.isArray(ri.ingredient) ? ri.ingredient[0] : ri.ingredient;
                return sum + (ri.amount * (ingredient?.costPerUnit ?? 0));
            }, 0);

            return {
                id: recipe.id,
                name: recipe.name ?? '',
                category: recipe.category ?? 'main',
                calories: recipe.calories ?? 0,
                protein: recipe.protein ?? 0,
                salt: recipe.salt ?? 0,
                costPerServing: ingredientCost > 0 ? ingredientCost : recipe.costPerServing ?? 0,
            };
        });

        console.log(`✅ Prepared ${recipeData.length} recipes for Dify\n`);

        // ========================================================================
        // Step 4: Build test input
        // ========================================================================
        console.log('📋 Step 4: Building test input...');

        const startDate = new Date().toISOString().slice(0, 10);

        const input = {
            crewCount: 20,
            days: 3,
            budgetPerPersonPerDay: 1200,
            minBudgetUsagePercent: 90,
            startDate,
            season: 'winter' as const,
            cookingTimeLimit: 60,
            bannedIngredients: [] as string[],
            weekdayRules: {} as Record<string, unknown>,
            allowedRecipeIds: [] as string[],
            recipes: recipeData,
        };

        console.log('✅ Test input prepared:');
        console.log(`   Crew count: ${input.crewCount}`);
        console.log(`   Days: ${input.days}`);
        console.log(`   Budget per person per day: ¥${input.budgetPerPersonPerDay}`);
        console.log(`   Start date: ${input.startDate}`);
        console.log(`   Season: ${input.season}\n`);

        // ========================================================================
        // Step 5: Call Dify API
        // ========================================================================
        console.log('📋 Step 5: Calling Dify API...');
        console.log('⏳ This may take up to 60 seconds...\n');

        const generator = new DifyMenuGenerator();
        const startTime = Date.now();

        const result = await generator.generate(input);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Dify API call completed in ${duration}s\n`);

        // ========================================================================
        // Step 6: Display results
        // ========================================================================
        console.log('\n📋 Generated menu:');
        result.days.forEach((day, index) => {
            console.log(`\n   Day ${index + 1}: ${day.date} (${day.dayLabel})`);
            console.log(`     Breakfast: ${day.breakfast.join(', ')}`);
            console.log(`     Lunch: ${day.lunch.join(', ')}`);
            console.log(`     Dinner: ${day.dinner.join(', ')}`);
        });

        // ========================================================================
        // Step 7: Verify recipe IDs
        // ========================================================================
        console.log('\n📋 Step 7: Verifying recipe IDs...');

        const validRecipeIds = new Set(recipeData.map(r => r.id));
        const allMenuRecipeIds = result.days.flatMap(day => [
            ...day.breakfast,
            ...day.lunch,
            ...day.dinner,
        ]);

        const invalidIds = allMenuRecipeIds.filter(id => !validRecipeIds.has(id));

        if (invalidIds.length > 0) {
            console.log(`⚠️  Found ${invalidIds.length} invalid recipe IDs:`);
            invalidIds.forEach(id => console.log(`     - ${id}`));
        } else {
            console.log('✅ All recipe IDs are valid');
        }

        // ========================================================================
        // Success
        // ========================================================================
        console.log('\n✅ Test completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed:');
        if (error instanceof Error) {
            console.error(`   ${error.message}`);
            if (error.stack) {
                console.error('\nStack trace:');
                console.error(error.stack);
            }
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}

main();
