/**
 * Dify API Client
 * 
 * Client library for WELLSHIP × Dify menu generation workflow integration
 */

import type {
    DifyWorkflowInput,
    DifyWorkflowOutput,
    DifyValidationResult,
    DifyAPIResponse,
    DifyClientConfig,
    DifyError as DifyErrorType,
    DifyValidationError as DifyValidationErrorType,
    DifyTimeoutError as DifyTimeoutErrorType,
    DifyNetworkError as DifyNetworkErrorType,
} from './dify-types';

import {
    DifyError,
    DifyValidationError,
    DifyTimeoutError,
    DifyNetworkError,
} from './dify-types';

export class DifyClient {
    private apiKey: string;
    private baseUrl: string;
    private maxRetries: number;
    private timeout: number;
    private retryDelay: number;

    constructor(config: DifyClientConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl;
        this.maxRetries = config.maxRetries ?? 3;
        this.timeout = config.timeout ?? 120000; // 120 seconds
        this.retryDelay = config.retryDelay ?? 2000; // 2 seconds
    }

    /**
     * Execute Dify workflow with menu generation parameters
     */
    async runWorkflow(inputs: DifyWorkflowInput): Promise<DifyValidationResult> {
        const url = `${this.baseUrl}/workflows/run`;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const requestBody = {
                    inputs,
                    response_mode: 'blocking',
                    user: 'wellship-server',
                };

                // Debug: Log the request payload
                console.log('📤 Sending request to Dify:');
                console.log('   URL:', url);
                console.log('   Inputs:');
                console.log(JSON.stringify(inputs, null, 2));
                console.log('');

                const response = await this.fetchWithTimeout(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    // Retry on 5xx errors
                    if (response.status >= 500 && attempt < this.maxRetries) {
                        console.warn(
                            `⚠️ Dify API error (${response.status}), retrying... (${attempt}/${this.maxRetries})`
                        );
                        await this.sleep(this.retryDelay * attempt);
                        continue;
                    }

                    const errorData = await response.json().catch(() => ({}));
                    throw new DifyError(
                        errorData.message || `Dify API error (${response.status})`,
                        errorData.code,
                        response.status
                    );
                }

                const data: DifyAPIResponse = await response.json();

                // Debug: Log the full response structure
                console.log('📋 Dify API Response Structure:');
                console.log(JSON.stringify(data, null, 2));
                console.log('');

                // Validate response structure
                if (!data.data?.outputs) {
                    throw new DifyValidationError(
                        'Invalid Dify response: missing outputs',
                        ['Response does not contain data.outputs']
                    );
                }

                const result = data.data.outputs;

                // Validate the menu structure
                this.validateMenuOutput(result);

                return result;
            } catch (error) {
                // Don't retry on validation errors
                if (error instanceof DifyValidationError) {
                    throw error;
                }

                // Retry on network errors
                if (attempt < this.maxRetries) {
                    console.warn(
                        `⚠️ Dify request failed, retrying... (${attempt}/${this.maxRetries})`,
                        error
                    );
                    await this.sleep(this.retryDelay * attempt);
                    continue;
                }

                // Final attempt failed
                if (error instanceof DifyError) {
                    throw error;
                }

                throw new DifyNetworkError(
                    `Dify API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    error
                );
            }
        }

        // Should never reach here
        throw new DifyError('Dify API request failed after all retries');
    }

    /**
     * Validate menu output structure
     */
    private validateMenuOutput(result: DifyValidationResult): void {
        const errors: string[] = [];

        console.log('🔍 Validating response structure...');
        console.log(`   result.success: ${result.success}`);
        console.log(`   result.menu exists: ${!!result.menu}`);

        // Check if validation was successful
        if (!result.success) {
            errors.push('Dify workflow validation failed');
            if (result.errors && result.errors.length > 0) {
                console.log(`   Dify errors: ${result.errors.join(', ')}`);
                errors.push(...result.errors);
            }
        }

        // Check menu structure
        if (!result.menu) {
            errors.push('Missing menu in response');
        } else {
            const menu = result.menu;

            if (!Array.isArray(menu.days)) {
                errors.push('menu.days is not an array');
            } else if (menu.days.length === 0) {
                errors.push('menu.days is empty');
            } else {
                console.log(`   Days count: ${menu.days.length}`);
                // Validate each day
                menu.days.forEach((day, index) => {
                    if (!day.date) {
                        errors.push(`Day ${index + 1}: missing date`);
                    }
                    if (!day.dayLabel) {
                        errors.push(`Day ${index + 1}: missing dayLabel`);
                    }
                    if (!Array.isArray(day.breakfast)) {
                        errors.push(`Day ${index + 1}: breakfast is not an array`);
                    }
                    if (!Array.isArray(day.lunch)) {
                        errors.push(`Day ${index + 1}: lunch is not an array`);
                    }
                    if (!Array.isArray(day.dinner)) {
                        errors.push(`Day ${index + 1}: dinner is not an array`);
                    }
                });
            }
        }

        if (errors.length > 0) {
            console.log('❌ Validation errors:');
            errors.forEach(err => console.log(`   - ${err}`));
            throw new DifyValidationError('Menu validation failed', errors);
        }

        console.log('✅ Validation passed\n');
    }

    /**
     * Fetch with timeout support
     */
    private async fetchWithTimeout(
        url: string,
        options: RequestInit
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new DifyTimeoutError(`Request timed out after ${this.timeout}ms`);
            }
            throw error;
        }
    }

    /**
     * Sleep utility for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/**
 * Create a Dify client from environment variables
 */
export function createDifyClient(): DifyClient {
    const apiKey = process.env.DIFY_API_KEY;
    const baseUrl = process.env.DIFY_BASE_URL;

    if (!apiKey) {
        throw new DifyError('DIFY_API_KEY environment variable is not set');
    }

    if (!baseUrl) {
        throw new DifyError('DIFY_BASE_URL environment variable is not set');
    }

    return new DifyClient({
        apiKey,
        baseUrl,
    });
}
