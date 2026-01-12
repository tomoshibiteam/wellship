import { NextRequest, NextResponse } from 'next/server';
import { MealType } from '@prisma/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/daily-menu/import-csv
 * CSVファイルから献立をインポート（複数日・複数食事タイプ対応）
 * 
 * サポートするCSVフォーマット:
 * 
 * 1. 献立付きフォーマット（推奨）:
 *    日付,食事タイプ,レシピ名,カテゴリ,食材名,使用量,単位,単価
 *    2024-12-14,lunch,鶏の照り焼き,main,鶏もも肉,180,g,1.8
 *    → 各日付・食事タイプごとに献立を作成
 * 
 * 2. シンプルフォーマット:
 *    レシピ名
 *    鶏の照り焼き
 *    → 指定された1日・1食事タイプに全て取り込む
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const vesselId = formData.get('vesselId') as string;
        const targetDate = formData.get('targetDate') as string;
        const mealType = formData.get('mealType') as string;

        if (!file || !vesselId || !targetDate || !mealType) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        const supabase = await createSupabaseServerClient();

        // CSVを読み込み
        const text = await file.text();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);

        if (lines.length === 0) {
            return NextResponse.json({ error: 'CSVが空です' }, { status: 400 });
        }

        // ヘッダー行を解析してフォーマットを判定
        const header = lines[0].toLowerCase();
        const isDetailedFormat = header.includes('日付') || header.includes('date');

        console.log('CSV import: isDetailedFormat', isDetailedFormat, 'lines', lines.length);

        if (isDetailedFormat) {
            // === 詳細フォーマット: 複数日・複数食事タイプに対応 ===
            const dataLines = lines.slice(1);
            const headerCols = header.split(',');
            const dateColumn = headerCols.findIndex(col => col.includes('日付') || col.includes('date'));
            const mealColumn = headerCols.findIndex(col => col.includes('食事') || col.includes('meal'));
            const recipeColumn = headerCols.findIndex(col => col.includes('レシピ') || col.includes('recipe'));

            console.log('CSV columns: date', dateColumn, 'meal', mealColumn, 'recipe', recipeColumn);
            console.log('CSV header cols:', headerCols);
            console.log('CSV first data line:', dataLines[0]);

            // 日付・食事タイプ別にレシピをグルーピング
            const menuData: Map<string, Set<string>> = new Map();

            for (const line of dataLines) {
                const cols = line.split(',');
                const lineDate = cols[dateColumn]?.trim();
                const lineMeal = cols[mealColumn]?.trim()?.toLowerCase();
                const recipeName = cols[recipeColumn]?.trim();

                console.log('CSV line parsed:', { lineDate, lineMeal, recipeName });

                if (!lineDate || !lineMeal || !recipeName) continue;

                const key = `${lineDate}|${lineMeal}`;
                if (!menuData.has(key)) {
                    menuData.set(key, new Set());
                }
                menuData.get(key)!.add(recipeName);
            }

            console.log('CSV import: grouped menus', menuData.size, 'keys:', Array.from(menuData.keys()));

            // 全レシピ名を収集
            const allRecipeNames = new Set<string>();
            for (const recipes of menuData.values()) {
                for (const name of recipes) {
                    allRecipeNames.add(name);
                }
            }

            // レシピをDBから取得
            const { data: recipes, error: recipeError } = await supabase
                .from('Recipe')
                .select('id,name')
                .in('name', Array.from(allRecipeNames));
            if (recipeError) {
                throw recipeError;
            }
            const recipeRows = recipes ?? [];
            const recipeMap = new Map(recipeRows.map(r => [r.name, r.id]));

            console.log('CSV import: found recipes in DB', recipeRows.length, 'of', allRecipeNames.size);

            // 各日付・食事タイプごとに献立を作成/更新
            let createdCount = 0;
            let updatedCount = 0;

            for (const [key, recipeNames] of menuData.entries()) {
                const [date, meal] = key.split('|');
                const recipeIds = Array.from(recipeNames)
                    .map(name => recipeMap.get(name))
                    .filter((id): id is string => id !== undefined);

                if (recipeIds.length === 0) continue;

                // 既存の献立を確認
                const { data: menuPlan, error: menuPlanError } = await supabase
                    .from('MenuPlan')
                    .select('id')
                    .eq('vesselId', vesselId)
                    .eq('date', date)
                    .eq('mealType', meal as MealType)
                    .maybeSingle();
                if (menuPlanError) {
                    throw menuPlanError;
                }

                if (menuPlan) {
                    // 既存を更新
                    await supabase
                        .from('MenuPlanRecipe')
                        .delete()
                        .eq('menuPlanId', menuPlan.id);
                    const { error: insertError } = await supabase
                        .from('MenuPlanRecipe')
                        .insert(
                            recipeIds.map(recipeId => ({
                                menuPlanId: menuPlan.id,
                                recipeId,
                            })),
                        );
                    if (insertError) {
                        throw insertError;
                    }
                    updatedCount++;
                } else {
                    // 新規作成
                    const { data: createdPlan, error: createError } = await supabase
                        .from('MenuPlan')
                        .insert({
                            vesselId,
                            date,
                            mealType: meal as MealType,
                            healthScore: 75,
                        })
                        .select('id')
                        .single();
                    if (createError) {
                        throw createError;
                    }
                    const { error: linkError } = await supabase
                        .from('MenuPlanRecipe')
                        .insert(
                            recipeIds.map(recipeId => ({
                                menuPlanId: createdPlan.id,
                                recipeId,
                            })),
                        );
                    if (linkError) {
                        throw linkError;
                    }
                    createdCount++;
                }
            }

            return NextResponse.json({
                success: true,
                message: `${createdCount}件の献立を作成、${updatedCount}件を更新しました`,
                count: createdCount + updatedCount,
                totalRecipes: recipes.length,
            });

        } else {
            // === シンプルフォーマット: 指定日・食事タイプに全て取り込む ===
            const dataLines = lines[0]?.includes('レシピ') || lines[0]?.includes('recipe')
                ? lines.slice(1)
                : lines;
            const recipeNames = dataLines.map(line => line.split(',')[0].trim()).filter(name => name);

            if (recipeNames.length === 0) {
                return NextResponse.json({ error: 'インポート対象のレシピが見つかりません' }, { status: 400 });
            }

            // レシピをDBから取得
            const { data: recipes, error: recipeError } = await supabase
                .from('Recipe')
                .select('id,name')
                .in('name', recipeNames);
            if (recipeError) {
                throw recipeError;
            }

            if (!recipes || recipes.length === 0) {
                return NextResponse.json({
                    error: '一致するレシピが見つかりませんでした。',
                    recipeNames,
                }, { status: 404 });
            }

            // 献立を作成/更新
            const { data: menuPlan, error: menuPlanError } = await supabase
                .from('MenuPlan')
                .select('id')
                .eq('vesselId', vesselId)
                .eq('date', targetDate)
                .eq('mealType', mealType as MealType)
                .maybeSingle();
            if (menuPlanError) {
                throw menuPlanError;
            }

            if (menuPlan) {
                await supabase
                    .from('MenuPlanRecipe')
                    .delete()
                    .eq('menuPlanId', menuPlan.id);
                const { error: insertError } = await supabase
                    .from('MenuPlanRecipe')
                    .insert(
                        recipes.map(r => ({
                            menuPlanId: menuPlan.id,
                            recipeId: r.id,
                        })),
                    );
                if (insertError) {
                    throw insertError;
                }
            } else {
                const { data: createdPlan, error: createError } = await supabase
                    .from('MenuPlan')
                    .insert({
                        vesselId,
                        date: targetDate,
                        mealType: mealType as MealType,
                        healthScore: 75,
                    })
                    .select('id')
                    .single();
                if (createError) {
                    throw createError;
                }
                const { error: linkError } = await supabase
                    .from('MenuPlanRecipe')
                    .insert(
                        recipes.map(r => ({ menuPlanId: createdPlan.id, recipeId: r.id })),
                    );
                if (linkError) {
                    throw linkError;
                }
            }

            return NextResponse.json({
                success: true,
                count: recipes.length,
                matchedRecipes: recipes.map(r => r.name),
            });
        }
    } catch (error) {
        console.error('POST import-csv error:', error);
        return NextResponse.json({ error: 'CSVの読み込みに失敗しました' }, { status: 500 });
    }
}
