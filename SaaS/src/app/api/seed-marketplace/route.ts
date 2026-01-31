import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * MVP商社機能用シードAPI
 * 食材の価格・Boost食材フラグを設定、仕入先マスタを作成
 * 開発環境でのみ使用可能
 */
export async function POST() {
    // 本番環境では無効化
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    try {
        const supabase = await createSupabaseServerClient();

        // 1. 仕入先マスタの作成
        const suppliers = [
            { id: 'supplier-main', name: '丸海水産', code: 'MARUKAI', isActive: true },
            { id: 'supplier-veg', name: '田中青果', code: 'TANAKA', isActive: true },
            { id: 'supplier-meat', name: '肉の山本', code: 'YAMAMOTO', isActive: true },
            { id: 'supplier-boost', name: 'フードレスキュー', code: 'RESCUE', isActive: true },
        ];

        const supplierResults = [];
        for (const supplier of suppliers) {
            const existing = await supabase
                .from('Supplier')
                .select('*')
                .eq('code', supplier.code)
                .maybeSingle();

            if (!existing.data) {
                const { data: newSupplier, error } = await supabase
                    .from('Supplier')
                    .insert(supplier)
                    .select()
                    .single();

                if (error) {
                    console.error('Failed to create supplier:', error);
                } else {
                    supplierResults.push(newSupplier);
                }
            } else {
                supplierResults.push(existing.data);
            }
        }

        // 2. 既存の食材を取得
        const { data: ingredients, error: ingredientsError } = await supabase
            .from('Ingredient')
            .select('id, name, storageType, costPerUnit')
            .limit(100);

        if (ingredientsError) {
            throw ingredientsError;
        }

        // 3. 食材ごとに価格とBoostフラグを設定
        // 名前に基づいてカテゴリを推測し、適切なサプライヤーと価格を設定
        const priceMap: Record<string, { price: number; supplierId: string; isBonus: boolean }> = {};

        // 野菜・果物系キーワード
        const vegKeywords = ['キャベツ', 'レタス', 'トマト', 'きゅうり', '玉ねぎ', 'にんじん', 'じゃがいも', 'ほうれん草', '大根', 'ねぎ', 'ナス', 'ピーマン', 'もやし', 'りんご', 'バナナ', 'みかん', 'レモン'];
        // 肉系キーワード
        const meatKeywords = ['豚', '鶏', '牛', 'ベーコン', 'ハム', 'ソーセージ', '肉', 'ミンチ', 'ひき肉'];
        // 魚介系キーワード
        const seafoodKeywords = ['鮭', 'サバ', 'まぐろ', 'えび', 'いか', 'たこ', 'あさり', 'ホタテ', '魚', 'シーフード', 'ツナ'];

        // Boost食材にするアイテム（ランダムに20%程度）
        const boostItems = new Set<string>();
        if (ingredients) {
            const boostCount = Math.max(1, Math.floor(ingredients.length * 0.2));
            const shuffled = [...ingredients].sort(() => Math.random() - 0.5);
            shuffled.slice(0, boostCount).forEach(ing => boostItems.add(ing.id));
        }

        const updateResults = [];
        if (ingredients) {
            for (const ing of ingredients) {
                let supplierId = 'supplier-main';
                let basePrice = Math.round((ing.costPerUnit || 100) * 1.2); // コストの1.2倍を標準価格に

                // カテゴリに基づいてサプライヤーを決定
                if (vegKeywords.some(kw => ing.name.includes(kw))) {
                    supplierId = 'supplier-veg';
                    basePrice = Math.round((ing.costPerUnit || 80) * 1.15);
                } else if (meatKeywords.some(kw => ing.name.includes(kw))) {
                    supplierId = 'supplier-meat';
                    basePrice = Math.round((ing.costPerUnit || 200) * 1.25);
                } else if (seafoodKeywords.some(kw => ing.name.includes(kw))) {
                    supplierId = 'supplier-main';
                    basePrice = Math.round((ing.costPerUnit || 300) * 1.2);
                }

                const isBonus = boostItems.has(ing.id);

                // Boost食材は30%オフ
                const price = isBonus ? Math.round(basePrice * 0.7) : basePrice;

                // Boost食材のサプライヤーはフードレスキュー
                const finalSupplierId = isBonus ? 'supplier-boost' : supplierId;

                const { error: updateError } = await supabase
                    .from('Ingredient')
                    .update({
                        price,
                        isBonus,
                        supplierId: finalSupplierId,
                    })
                    .eq('id', ing.id);

                if (updateError) {
                    console.error(`Failed to update ingredient ${ing.name}:`, updateError);
                } else {
                    updateResults.push({
                        id: ing.id,
                        name: ing.name,
                        price,
                        isBonus,
                        supplierId: finalSupplierId,
                    });
                }
            }
        }

        // 4. Vesselのbudget設定を確認・更新
        const { data: vessels, error: vesselsError } = await supabase
            .from('Vessel')
            .select('id, name, budgetPerDay')
            .limit(10);

        if (!vesselsError && vessels) {
            for (const vessel of vessels) {
                // budgetPerDayがnullまたは0の場合、1400に設定
                if (!vessel.budgetPerDay) {
                    await supabase
                        .from('Vessel')
                        .update({ budgetPerDay: 1400 })
                        .eq('id', vessel.id);
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                suppliers: supplierResults,
                ingredientsUpdated: updateResults.length,
                boostItems: updateResults.filter(r => r.isBonus).length,
                sampleIngredients: updateResults.slice(0, 10),
            },
            message: `商社機能用データを設定しました。${updateResults.length}件の食材を更新、${updateResults.filter(r => r.isBonus).length}件をBoost食材に設定`,
        });
    } catch (error) {
        console.error('Seed error:', error);
        return NextResponse.json(
            { error: 'Failed to seed marketplace data', details: error },
            { status: 500 }
        );
    }
}
