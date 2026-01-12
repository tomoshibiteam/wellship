/**
 * AI Provider Factory
 * 
 * Factory function to get the appropriate menu generator based on feature flags
 */

import { features } from '@/lib/config/features';
import type { MenuGenerator } from './types';
import { GeminiMenuGenerator } from './gemini';
import { DifyMenuGenerator } from './dify';

/**
 * Get menu generator instance based on current feature flags
 * 
 * @returns MenuGenerator instance (Gemini or Dify)
 * @throws Error if provider is not configured
 */
export function getMenuGenerator(): MenuGenerator {
    const provider = features.aiProvider;

    console.log(`🤖 Using AI provider: ${provider}`);

    switch (provider) {
        case 'dify':
            return new DifyMenuGenerator();

        case 'gemini':
        default:
            return new GeminiMenuGenerator();
    }
}

/**
 * Check if current AI provider is available
 * 
 * @returns boolean indicating if provider is properly configured
 */
export function isAIProviderAvailable(): boolean {
    const provider = features.aiProvider;

    try {
        if (provider === 'dify') {
            return !!(
                process.env.DIFY_API_KEY &&
                (process.env.DIFY_WORKFLOW_URL || process.env.DIFY_BASE_URL)
            );
        }
        if (provider === 'gemini') {
            return !!process.env.GEMINI_API_KEY;
        }
        return false;
    } catch {
        return false;
    }
}

// Re-export types for convenience
export type { MenuGenerator, MenuGenInput, MenuGenOutput, RecipeInfo } from './types';
export { MenuGenerationError, MenuValidationError } from './types';
