'use client';

/**
 * 共通ローディングスピナー
 */
export function LoadingSpinner({
    size = 'md',
    className = '',
}: {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const sizeClasses = {
        sm: 'h-4 w-4 border-2',
        md: 'h-6 w-6 border-2',
        lg: 'h-10 w-10 border-3',
    };

    return (
        <div
            className={`animate-spin rounded-full border-sky-500 border-t-transparent ${sizeClasses[size]} ${className}`}
        />
    );
}

/**
 * ページ全体のローディング状態
 */
export function PageLoading({ message = '読み込み中...' }: { message?: string }) {
    return (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-slate-500">{message}</p>
        </div>
    );
}

/**
 * ボタン内のローディング状態
 */
export function ButtonLoading({ text = '処理中...' }: { text?: string }) {
    return (
        <span className="flex items-center justify-center gap-2">
            <LoadingSpinner size="sm" className="border-white border-t-transparent" />
            {text}
        </span>
    );
}
