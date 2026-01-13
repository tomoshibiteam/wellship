import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

export default function Home() {
    // ルートパスからログインページにリダイレクト
    redirect(ROUTES.auth.login);
}
