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

import { PrismaClient } from '@prisma/client';
import { createDifyClient } from '../src/lib/ai/dify-client';
import type { DifyWorkflowInput } from '../src/lib/ai/dify-types';

const prisma = new PrismaClient();

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

        const recipes = await prisma.recipe.findMany({
            include: {
                ingredients: {
                    include: {
                        ingredient: true,
                    },
                },
            },
            take: 20, // Limit to 20 recipes for testing
        });

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
            const ingredientCost = recipe.ingredients.reduce((sum, ri) => {
                return sum + (ri.amount * ri.ingredient.costPerUnit);
            }, 0);

            return {
                id: recipe.id,
                name: recipe.name,
                category: recipe.category,
                calories: recipe.calories,
                protein: recipe.protein,
                salt: recipe.salt,
                costPerServing: ingredientCost > 0 ? ingredientCost : recipe.costPerServing,
            };
        });

        console.log(`✅ Prepared ${recipeData.length} recipes for Dify\n`);

        // ========================================================================
        // Step 4: Build test input
        // ========================================================================
        console.log('📋 Step 4: Building test input...');

        const startDate = new Date().toISOString().slice(0, 10);

        const input: DifyWorkflowInput = {
            crew_count: 20,
            days: 3,
            budget_per_person_per_day: 1200,
            min_budget_usage_percent: 90,
            start_date: startDate,
            season: 'winter',
            cooking_time_limit: 60,
            banned_ingredients: '',
            weekday_rules: JSON.stringify({}),
            // Format recipes with newlines for Dify
            recipes: JSON.stringify(recipeData, null, 1),
        };

        console.log('✅ Test input prepared:');
        console.log(`   Crew count: ${input.crew_count}`);
        console.log(`   Days: ${input.days}`);
        console.log(`   Budget per person per day: ¥${input.budget_per_person_per_day}`);
        console.log(`   Start date: ${input.start_date}`);
        console.log(`   Season: ${input.season}\n`);

        // ========================================================================
        // Step 5: Call Dify API
        // ========================================================================
        console.log('📋 Step 5: Calling Dify API...');
        console.log('⏳ This may take up to 60 seconds...\n');

        const client = createDifyClient();
        const startTime = Date.now();

        const result = await client.runWorkflow(input);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Dify API call completed in ${duration}s\n`);

        // ========================================================================
        // Step 6: Display results
        // ========================================================================
        console.log('📋 Step 6: Validation results:');
        console.log(`   Valid: ${result.success ? '✅' : '❌'}`);
        console.log(`   Total days: ${result.total_days}`);
        console.log(`   Total recipes: ${result.total_recipes}`);

        if (result.errors && result.errors.length > 0) {
            console.log(`   Errors: ${result.errors.length}`);
            result.errors.forEach((error, i) => {
                console.log(`     ${i + 1}. ${error}`);
            });
        }

        if (result.warnings && result.warnings.length > 0) {
            console.log(`   Warnings: ${result.warnings.length}`);
            result.warnings.forEach((warning, i) => {
                console.log(`     ${i + 1}. ${warning}`);
            });
        }

        console.log('\n📋 Generated menu:');
        result.menu.days.forEach((day, index) => {
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
        const allMenuRecipeIds = result.menu.days.flatMap(day => [
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
    } finally {
        await prisma.$disconnect();
    }
}

main();
