'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error';

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
}

// TODO: 実際のサプライヤーIDは認証から取得
const SUPPLIER_ID = 'supplier-sasebo-1';

export default function SupplierProductsClient() {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showAddForm, setShowAddForm] = useState(false);
    const [newProduct, setNewProduct] = useState({
        productName: '',
        productCode: '',
        category: '',
        price: '',
        unit: 'kg',
        minOrderQty: '1',
        leadDays: '1',
        description: '',
    });
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/suppliers/${SUPPLIER_ID}/products`);
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products || []);
            } else {
                setError('商品の取得に失敗しました');
            }
        } catch {
            setError('商品の取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddProduct = async () => {
        if (!newProduct.productName || !newProduct.price || !newProduct.unit) return;

        setIsAdding(true);
        try {
            const res = await fetch(`/api/suppliers/${SUPPLIER_ID}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productName: newProduct.productName,
                    productCode: newProduct.productCode || null,
                    category: newProduct.category || null,
                    description: newProduct.description || null,
                    price: parseInt(newProduct.price, 10),
                    unit: newProduct.unit,
                    minOrderQty: parseFloat(newProduct.minOrderQty) || 1,
                    leadDays: parseInt(newProduct.leadDays, 10) || 1,
                }),
            });

            if (res.ok) {
                setNewProduct({
                    productName: '',
                    productCode: '',
                    category: '',
                    price: '',
                    unit: 'kg',
                    minOrderQty: '1',
                    leadDays: '1',
                    description: '',
                });
                setShowAddForm(false);
                await fetchProducts();
            }
        } catch {
            setError('商品の追加に失敗しました');
        } finally {
            setIsAdding(false);
        }
    };

    const handleToggleAvailable = async (productId: string, currentStatus: boolean) => {
        try {
            const res = await fetch(`/api/suppliers/${SUPPLIER_ID}/products/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isAvailable: !currentStatus }),
            });

            if (res.ok) {
                await fetchProducts();
            }
        } catch {
            setError('ステータスの更新に失敗しました');
        }
    };

    if (isLoading) {
        return <PageLoading message="商品情報を読み込み中..." />;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="商品カタログ管理"
                description="自社の商品を登録・管理します"
                badge="Supplier"
            />

            {error && (
                <ErrorBanner message={error} onClose={() => setError(null)} />
            )}

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-600">
                        登録商品数: <span className="font-semibold text-slate-900">{products.length}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        承認待ち: {products.filter(p => !p.isApproved).length}件
                    </p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                    + 新規商品追加
                </button>
            </div>

            {/* 商品追加フォーム */}
            {showAddForm && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">新規商品登録</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                商品名 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="例: 熊本産トマト 5kg箱"
                                value={newProduct.productName}
                                onChange={(e) => setNewProduct({ ...newProduct, productName: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                商品コード
                            </label>
                            <input
                                type="text"
                                placeholder="例: TM-001"
                                value={newProduct.productCode}
                                onChange={(e) => setNewProduct({ ...newProduct, productCode: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                カテゴリ
                            </label>
                            <select
                                value={newProduct.category}
                                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            >
                                <option value="">選択してください</option>
                                <option value="野菜">野菜</option>
                                <option value="肉">肉</option>
                                <option value="魚">魚</option>
                                <option value="調味料">調味料</option>
                                <option value="乳製品">乳製品</option>
                                <option value="穀物">穀物</option>
                                <option value="その他">その他</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                単価（円） <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="2500"
                                    value={newProduct.price}
                                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                                />
                                <select
                                    value={newProduct.unit}
                                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                                >
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="個">個</option>
                                    <option value="本">本</option>
                                    <option value="袋">袋</option>
                                    <option value="箱">箱</option>
                                    <option value="L">L</option>
                                    <option value="mL">mL</option>
                                    <option value="セット">セット</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                最小発注量
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                value={newProduct.minOrderQty}
                                onChange={(e) => setNewProduct({ ...newProduct, minOrderQty: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                配送日数
                            </label>
                            <input
                                type="number"
                                value={newProduct.leadDays}
                                onChange={(e) => setNewProduct({ ...newProduct, leadDays: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            商品説明
                        </label>
                        <textarea
                            placeholder="商品の特徴や産地などを記入"
                            value={newProduct.description}
                            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                            rows={3}
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleAddProduct}
                            disabled={!newProduct.productName || !newProduct.price || isAdding}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {isAdding ? '登録中...' : '登録'}
                        </button>
                    </div>
                    <p className="text-xs text-slate-500">
                        ※ 登録後、WELLSHIP本部の承認を経て船側に表示されます
                    </p>
                </div>
            )}

            {/* 商品リスト */}
            {products.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
                    <p className="text-4xl mb-3">📦</p>
                    <p className="text-sm text-slate-600">商品が登録されていません</p>
                    <p className="text-xs text-slate-500 mt-1">「新規商品追加」から登録してください</p>
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
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">承認状態</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">販売状態</th>
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
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${product.isApproved
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {product.isApproved ? '✓ 承認済み' : '⏳ 承認待ち'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleToggleAvailable(product.id, product.isAvailable)}
                                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${product.isAvailable
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {product.isAvailable ? '販売中' : '停止中'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
