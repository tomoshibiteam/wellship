export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // 認証ページ（ログイン等）はサイドバーなしのシンプルレイアウト
    return <>{children}</>;
}
