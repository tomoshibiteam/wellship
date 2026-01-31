import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MatchedProduct = {
    ingredientId: string;
    productId: string;
    productName: string;
    supplierId: string;
    supplierName: string;
    price: number;
    unit: string;
    minOrderQty: number;
    leadDays: number;
};

/**
 * 複数の食材IDに対して最適なサプライヤー商品をマッチングする
 * 戦略: 指定された港に配送可能で、かつ承認・在庫ありの商品の中から「最安値」を選択
 */
export async function matchProductsForIngredients(
    ingredientIds: string[],
    deliveryPort: string = "佐世保港"
): Promise<Map<string, MatchedProduct>> {
    const supabase = await createSupabaseServerClient();

    // 1. 候補となるサプライヤー商品を一括取得
    // isApproved, isAvailable が true のもの
    // かつ、指定された ingredientIds に含まれるもの
    const { data: products, error } = await supabase
        .from("SupplierProduct")
        .select(`
      id,
      productName,
      price,
      unit,
      minOrderQty,
      leadDays,
      supplierId,
      ingredientId,
      supplier:Supplier!inner (
        id,
        name,
        deliveryPorts
      )
    `)
        .in("ingredientId", ingredientIds)
        .eq("isApproved", true)
        .eq("isAvailable", true)
        .order("price", { ascending: true }); // 安い順にソートしておく

    if (error) {
        console.error("Failed to match products:", error);
        return new Map();
    }

    const matches = new Map<string, MatchedProduct>();

    // 2. マッチング処理
    // すでに price ASC でソートされているため、最初に見つかった適合商品を「最安」として採用する
    for (const p of products) {
        if (!p.ingredientId) continue;

        // すでにマッチング済みの食材ならスキップ（最安値採用済み）
        if (matches.has(p.ingredientId)) continue;

        // サプライヤーの配送エリアチェック
        // supplierはinner joinしているので存在するはずだが型定義上確認
        const supplier = Array.isArray(p.supplier) ? p.supplier[0] : p.supplier;
        if (!supplier) continue;

        const ports = (supplier.deliveryPorts || "").split(",").map((s: string) => s.trim());
        if (!ports.includes(deliveryPort)) {
            continue; // この港には配送できない
        }

        // 採用
        matches.set(p.ingredientId, {
            ingredientId: p.ingredientId,
            productId: p.id,
            productName: p.productName,
            supplierId: supplier.id,
            supplierName: supplier.name,
            price: p.price,
            unit: p.unit,
            minOrderQty: p.minOrderQty,
            leadDays: p.leadDays,
        });
    }

    return matches;
}
