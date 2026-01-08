import type { SessionUser, UserRole } from '@/lib/types/auth';

/**
 * ユーザーが特定の船にアクセスできるかチェック
 */
export function canAccessVessel(user: SessionUser, vesselId: string): boolean {
    switch (user.role) {
        case 'CHEF':
            return user.vesselIds.includes(vesselId);
        case 'MANAGER':
            // 会社内の全船舶にアクセス可能（companyIdチェックは別途行う）
            return true;
        default:
            return false;
    }
}

/**
 * フィードバック作成権限のチェック
 */
export function canCreateFeedback(user: SessionUser): boolean {
    // 司厨がフィードバック収集を管理
    return user.role === 'CHEF';
}

/**
 * 献立編集権限のチェック
 */
export function canEditMenuPlan(user: SessionUser, vesselId: string): boolean {
    return user.role === 'CHEF' && user.vesselIds.includes(vesselId);
}

/**
 * 調達リスト編集権限のチェック
 */
export function canEditProcurement(user: SessionUser, vesselId: string): boolean {
    return user.role === 'CHEF' && user.vesselIds.includes(vesselId);
}

/**
 * ロール名を日本語で返す
 */
export function getRoleDisplayName(role: UserRole): string {
    switch (role) {
        case 'CHEF':
            return '現場側(司厨)';
        case 'MANAGER':
            return '管理側(本部)';
        default:
            return role;
    }
}

/**
 * ロール別の許可パス
 */
export const ROLE_PERMISSIONS = {
    CHEF: {
        allowedPaths: ['/planning', '/daily-menu', '/procurement', '/feedback', '/feedback-entry', '/feedback-summary'],
        defaultRedirect: '/planning',
    },
    MANAGER: {
        allowedPaths: ['/feedback-insights', '/manager', '/executive'],
        defaultRedirect: '/manager/dashboard',
    },
} as const;
