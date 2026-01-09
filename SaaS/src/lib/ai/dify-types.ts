/**
 * Dify API Type Definitions
 * 
 * Types for WELLSHIP × Dify menu generation workflow integration
 */

// ============================================================================
// Input Types
// ============================================================================

export interface DifyWorkflowInput {
    /** 乗員数 */
    crew_count: number;

    /** 献立日数 */
    days: number;

    /** 1人1日あたりの予算（円） */
    budget_per_person_per_day: number;

    /** 最低予算消化率（%） */
    min_budget_usage_percent: number;

    /** 開始日（YYYY-MM-DD） */
    start_date: string;

    /** 季節（任意） */
    season?: 'spring' | 'summer' | 'autumn' | 'winter' | '';

    /** 調理時間上限（分）（任意） */
    cooking_time_limit?: number;

    /** 禁止食材（カンマ区切り）（任意） */
    banned_ingredients?: string;

    /** 曜日ルール（JSON文字列）（任意） */
    weekday_rules?: string;

    /** 使用可能レシピID（カンマ区切り）（任意） */
    allowed_recipe_ids?: string;

    /** レシピマスタJSON文字列 */
    recipes?: string;
}

// ============================================================================
// Output Types
// ============================================================================

export interface DifyMenuDay {
    /** 日付（YYYY-MM-DD） */
    date: string;

    /** 曜日ラベル */
    dayLabel: string;

    /** 朝食のレシピID配列 */
    breakfast: string[];

    /** 昼食のレシピID配列 */
    lunch: string[];

    /** 夕食のレシピID配列 */
    dinner: string[];
}

export interface DifyWorkflowOutput {
    /** 日別献立配列 */
    days: DifyMenuDay[];
}

export interface DifyValidationResult {
    /** 検証成功フラグ */
    success: boolean;

    /** エラーリスト */
    errors: string[];

    /** 警告リスト */
    warnings: string[];

    /** 検証済み献立データ */
    menu: DifyWorkflowOutput;

    /** 総日数 */
    total_days: number;

    /** 総レシピ数 */
    total_recipes: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface DifyAPIResponse {
    /** ワークフロー実行ID */
    workflow_run_id: string;

    /** タスクID */
    task_id: string;

    /** データ（検証結果） */
    data: {
        outputs: DifyValidationResult;
    };

    /** ステータス */
    status: 'succeeded' | 'failed' | 'stopped';
}

export interface DifyAPIError {
    /** エラーコード */
    code: string;

    /** エラーメッセージ */
    message: string;

    /** ステータスコード */
    status: number;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface DifyClientConfig {
    /** Dify API Key */
    apiKey: string;

    /** Dify Base URL */
    baseUrl: string;

    /** リトライ回数（デフォルト: 3） */
    maxRetries?: number;

    /** タイムアウト（ミリ秒）（デフォルト: 60000） */
    timeout?: number;

    /** リトライ間隔（ミリ秒）（デフォルト: 2000） */
    retryDelay?: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class DifyError extends Error {
    constructor(
        message: string,
        public code?: string,
        public status?: number,
        public originalError?: unknown
    ) {
        super(message);
        this.name = 'DifyError';
    }
}

export class DifyValidationError extends DifyError {
    constructor(message: string, public validationErrors: string[]) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'DifyValidationError';
    }
}

export class DifyTimeoutError extends DifyError {
    constructor(message: string = 'Dify API request timed out') {
        super(message, 'TIMEOUT_ERROR');
        this.name = 'DifyTimeoutError';
    }
}

export class DifyNetworkError extends DifyError {
    constructor(message: string, originalError?: unknown) {
        super(message, 'NETWORK_ERROR', undefined, originalError);
        this.name = 'DifyNetworkError';
    }
}
