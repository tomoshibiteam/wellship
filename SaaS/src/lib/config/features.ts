/**
 * Feature Flags for WELLSHIP MVP
 * 
 * Centralized feature flag management for controlling MVP scope.
 * All flags are read from environment variables and are immutable at runtime.
 */

export const features = {
    /**
     * Photo Feedback Feature
     * 
     * Controls whether photo capture and AI analysis are enabled in feedback flow.
     * When false (MVP default):
     * - Camera capture UI is hidden
     * - Photo upload API is disabled
     * - AI analysis is skipped
     * - photoUrl and AI fields are saved as null
     */
    photoFeedback: process.env.WELLSHIP_PHOTO_FEEDBACK_ENABLED === 'true',

    /**
     * AI Provider Selection
     * 
     * Controls which AI provider is used for menu generation.
     * Options:
     * - 'dify': Use Dify Workflow API (MVP default)
     * - 'gemini': Use Google Gemini API directly (fallback)
     */
    aiProvider: (process.env.WELLSHIP_AI_PROVIDER || 'gemini') as 'gemini' | 'dify',

    /**
     * Procurement Sourcing Constraints
     * 
     * Controls whether sourcing constraints are applied in menu generation.
     * When true:
     * - Only uses recipes with available ingredients
     * - Filters recipes based on procurement adjustments
     */
    sourcing: process.env.WELLSHIP_SOURCING_ENABLED === 'true',
} as const;

/**
 * Type-safe feature flag access
 */
export type FeatureFlags = typeof features;

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return Boolean(features[feature]);
}

/**
 * Get current AI provider
 */
export function getAIProvider(): 'gemini' | 'dify' {
    return features.aiProvider;
}

/**
 * Environment variable validation
 * Call this at server startup to ensure all required env vars are set
 */
export function validateFeatureFlags(): void {
    const warnings: string[] = [];

    // Check AI provider configuration
    if (features.aiProvider === 'dify') {
        if (!process.env.DIFY_API_KEY) {
            warnings.push('DIFY_API_KEY is not set but aiProvider is "dify"');
        }
        if (!process.env.DIFY_WORKFLOW_URL && !process.env.DIFY_APP_ID) {
            warnings.push('Neither DIFY_WORKFLOW_URL nor DIFY_APP_ID is set');
        }
    }

    if (features.aiProvider === 'gemini') {
        if (!process.env.GEMINI_API_KEY) {
            warnings.push('GEMINI_API_KEY is not set but aiProvider is "gemini"');
        }
    }

    if (warnings.length > 0) {
        console.warn('⚠️  Feature Flag Configuration Warnings:');
        warnings.forEach(w => console.warn(`   - ${w}`));
    }
}
