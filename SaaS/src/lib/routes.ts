/**
 * Wellship アプリケーションのルート定義
 * 全てのページ遷移はこの定数を参照すること
 */

export const ROUTES = {
    // 認証
    auth: {
        login: '/login',
        logout: '/logout',
    },

    // Chef（司厨）側
    chef: {
        root: '/app/chef',
        recipes: '/app/chef/recipes',
        planning: '/app/chef/planning',
        dailyMenu: '/app/chef/daily-menu',
        feedback: '/app/chef/feedback',
        feedbackSummary: '/app/chef/feedback/summary',
        procurement: '/app/chef/procurement',
        orders: '/app/chef/orders',  // 発注履歴
    },

    // Manager（本部）側
    manager: {
        root: '/app/manager',
        dashboard: '/app/manager/dashboard',
        vessels: '/app/manager/vessels',
        vesselDetail: (vesselId: string) => `/app/manager/vessels/${vesselId}`,
        suppliers: '/app/manager/suppliers',
        insights: '/app/manager/insights',
        executiveSummary: '/app/manager/executive/summary',
        settings: '/app/manager/settings',
        settingsUsers: '/app/manager/settings/users',
        orders: '/app/manager/orders',
    },

    // Supplier（サプライヤー）側
    supplier: {
        root: '/app/supplier',
        products: '/app/supplier/products',
    },

    // キオスク
    kiosk: {
        entry: '/entry',
    },

    // アプリルート（ロール別リダイレクト用）
    app: '/app',
} as const;

/**
 * ロールに応じたデフォルトページを取得
 */
export function getDefaultRouteForRole(role: 'CHEF' | 'MANAGER' | 'SUPPLIER'): string {
    switch (role) {
        case 'CHEF':
            return ROUTES.chef.recipes;
        case 'MANAGER':
            return ROUTES.manager.dashboard;
        case 'SUPPLIER':
            return ROUTES.supplier.products;
        default:
            return ROUTES.auth.login;
    }
}

/**
 * 旧URL → 新URL のマッピング
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
    // Chef旧URL
    '/recipes': ROUTES.chef.recipes,
    '/planning': ROUTES.chef.planning,
    '/daily-menu': ROUTES.chef.dailyMenu,
    '/feedback': ROUTES.chef.feedback,
    '/feedback-summary': ROUTES.chef.feedbackSummary,
    '/procurement': ROUTES.chef.procurement,

    // Manager旧URL
    '/manager/dashboard': ROUTES.manager.dashboard,
    '/manager/vessels': ROUTES.manager.vessels,
    '/manager/insights': ROUTES.manager.insights,
    '/manager/executive/summary': ROUTES.manager.executiveSummary,
    '/manager/settings': ROUTES.manager.settings,
    '/manager/settings/users': ROUTES.manager.settingsUsers,
};
