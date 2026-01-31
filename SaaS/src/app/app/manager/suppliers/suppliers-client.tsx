'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error';

interface Supplier {
    id: string;
    name: string;
    code: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    deliveryPorts: string[];
    isActive: boolean;
}

interface Product {
    id: string;
    productName: string;
    productCode: string | null;
    category: string | null;
    price: number;
    unit: string;
    minOrderQty: number;
    isAvailable: boolean;
    isApproved: boolean;
    leadDays: number;
    Ingredient: { id: string; name: string } | null;
}

export default function SuppliersClient() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 新規サプライヤー追加フォーム
    const [showAddForm, setShowAddForm] = useState(false);
    const [newSupplier, setNewSupplier] = useState({
        name: '',
        code: '',
        email: '',
        phone: '',
        address: '',
        deliveryPorts: '',
    });
    const [isAdding, setIsAdding] = useState(false);

    // サプライヤー一覧を取得
    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/suppliers');
            if (res.ok) {
                const data = await res.json();
                setSuppliers(data.suppliers || []);
            } else {
                setError('サプライヤーの取得に失敗しました');
            }
        } catch {
            setError('サプライヤーの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    // サプライヤーの商品を取得
    const fetchProducts = async (supplierId: string) => {
        setIsLoadingProducts(true);
        try {
            const res = await fetch(`/api/suppliers/${supplierId}/products`);
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products || []);
            }
        } catch {
            console.error('Failed to fetch products');
        } finally {
            setIsLoadingProducts(false);
        }
    };

    // サプライヤー選択
    const handleSelectSupplier = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        fetchProducts(supplier.id);
    };

    // サプライヤー追加
    const handleAddSupplier = async () => {
        if (!newSupplier.name || !newSupplier.code) return;

        setIsAdding(true);
        try {
            const res = await fetch('/api/suppliers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newSupplier.name,
                    code: newSupplier.code,
                    email: newSupplier.email || null,
                    phone: newSupplier.phone || null,
                    address: newSupplier.address || null,
                    deliveryPorts: newSupplier.deliveryPorts.split(',').map(p => p.trim()).filter(Boolean),
                }),
            });

            if (res.ok) {
                setNewSupplier({ name: '', code: '', email: '', phone: '', address: '', deliveryPorts: '' });
                setShowAddForm(false);
                await fetchSuppliers();
            } else {
                const data = await res.json();
                setError(data.error || 'サプライヤーの追加に失敗しました');
            }
        } catch {
            setError('サプライヤーの追加に失敗しました');
        } finally {
            setIsAdding(false);
        }
    };

    // 商品承認トグル
    const handleToggleApproval = async (productId: string, currentStatus: boolean) => {
        if (!selectedSupplier) return;

        try {
            const res = await fetch(`/api/suppliers/${selectedSupplier.id}/products/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isApproved: !currentStatus }),
            });

            if (res.ok) {
                await fetchProducts(selectedSupplier.id);
            }
        } catch {
            setError('承認状態の更新に失敗しました');
        }
    };

    if (isLoading) {
        return <PageLoading message="サプライヤー情報を読み込み中..." />;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="サプライヤー管理"
                description="提携サプライヤーと商品カタログを管理します"
                badge="Manager"
            />

            {error && (
                <ErrorBanner message={error} onClose={() => setError(null)} />
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* サプライヤー一覧 */}
                <div className="space-y-4 lg:col-span-1">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">サプライヤー一覧</h2>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                        >
                            + 追加
                        </button>
                    </div>

                    {/* 追加フォーム */}
                    {showAddForm && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-slate-800">新規サプライヤー</h3>
                            <input
                                type="text"
                                placeholder="サプライヤー名"
                                value={newSupplier.name}
                                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            />
                            <input
                                type="text"
                                placeholder="サプライヤーコード"
                                value={newSupplier.code}
                                onChange={(e) => setNewSupplier({ ...newSupplier, code: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            />
                            <input
                                type="email"
                                placeholder="メールアドレス（任意）"
                                value={newSupplier.email}
                                onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            />
                            <input
                                type="tel"
                                placeholder="電話番号（任意）"
                                value={newSupplier.phone}
                                onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            />
                            <input
                                type="text"
                                placeholder="配送可能港（カンマ区切り）"
                                value={newSupplier.deliveryPorts}
                                onChange={(e) => setNewSupplier({ ...newSupplier, deliveryPorts: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleAddSupplier}
                                    disabled={!newSupplier.name || !newSupplier.code || isAdding}
                                    className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {isAdding ? '追加中...' : '追加'}
                                </button>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    )}

                    {/* サプライヤーリスト */}
                    <div className="space-y-2">
                        {suppliers.length === 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                                サプライヤーが登録されていません
                            </div>
                        ) : (
                            suppliers.map((supplier) => (
                                <button
                                    key={supplier.id}
                                    onClick={() => handleSelectSupplier(supplier)}
                                    className={`w-full rounded-xl border-2 p-4 text-left transition ${selectedSupplier?.id === supplier.id
                                            ? 'border-slate-900 bg-slate-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg">
                                            🏪
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-900 truncate">{supplier.name}</p>
                                            <p className="text-xs text-slate-500">{supplier.code}</p>
                                        </div>
                                    </div>
                                    {supplier.deliveryPorts.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {supplier.deliveryPorts.slice(0, 3).map((port) => (
                                                <span
                                                    key={port}
                                                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                                                >
                                                    📍{port}
                                                </span>
                                            ))}
                                            {supplier.deliveryPorts.length > 3 && (
                                                <span className="text-xs text-slate-400">
                                                    +{supplier.deliveryPorts.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* 商品一覧（承認管理） */}
                <div className="space-y-4 lg:col-span-2">
                    {selectedSupplier ? (
                        <>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">
                                        {selectedSupplier.name} の商品カタログ
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        {selectedSupplier.email && `📧 ${selectedSupplier.email}`}
                                        {selectedSupplier.phone && ` | 📞 ${selectedSupplier.phone}`}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-600">
                                        承認待ち: <span className="font-semibold text-amber-600">
                                            {products.filter(p => !p.isApproved).length}件
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {/* 商品リスト */}
                            {isLoadingProducts ? (
                                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                                    読み込み中...
                                </div>
                            ) : products.length === 0 ? (
                                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                                    商品が登録されていません
                                </div>
                            ) : (
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">商品名</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">カテゴリ</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">単価</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">最小発注</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">納期</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">販売状態</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">承認</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {products.map((product) => (
                                                <tr key={product.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-slate-900">{product.productName}</p>
                                                        {product.productCode && (
                                                            <p className="text-xs text-slate-500">{product.productCode}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                                            {product.category || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="font-semibold text-slate-900">
                                                            ¥{product.price.toLocaleString()}
                                                        </span>
                                                        <span className="text-xs text-slate-500">/{product.unit}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                                                        {product.minOrderQty}{product.unit}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                                                        {product.leadDays}日
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${product.isAvailable
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {product.isAvailable ? '販売中' : '停止中'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleToggleApproval(product.id, product.isApproved)}
                                                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${product.isApproved
                                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                                }`}
                                                        >
                                                            {product.isApproved ? '✓ 承認済み' : '⏳ 承認する'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <p className="text-xs text-slate-500">
                                💡 承認された商品のみが船側の調達リストに表示されます
                            </p>
                        </>
                    ) : (
                        <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                            <div className="text-center">
                                <p className="text-4xl mb-2">👈</p>
                                <p className="text-sm text-slate-500">サプライヤーを選択してください</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
