import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { ROUTES, getDefaultRouteForRole } from '@/lib/routes';

/**
 * /app にアクセスした場合、ログインユーザーのロールに応じて適切なページにリダイレクト
 */
export default async function AppRootPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect(ROUTES.auth.login);
    }

    const defaultRoute = getDefaultRouteForRole(user.role as 'CHEF' | 'MANAGER');
    redirect(defaultRoute);
}
