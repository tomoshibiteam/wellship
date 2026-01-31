import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// GET: 食材に対応する全サプライヤーの商品を取得
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const ingredientId = searchParams.get('ingredientId');
        const ingredientName = searchParams.get('name');
        const deliveryPort = searchParams.get('port');

        const supabase = await createSupabaseServerClient();

        let query = supabase
            .from('SupplierProduct')
            .select(`
                id,
                productName,
                productCode,
                category,
                price,
                unit,
                minOrderQty,
                maxOrderQty,
                isAvailable,
                leadDays,
                supplierId,
                ingredientId,
                Supplier:supplierId(id, name, code, deliveryPorts)
            `)
            .eq('isAvailable', true)
            .order('price', { ascending: true });

        // ingredientIdで絞り込み
        if (ingredientId) {
            query = query.eq('ingredientId', ingredientId);
        }

        // 商品名で部分一致検索（食材名での検索用）
        if (ingredientName) {
            query = query.ilike('productName', `%${ingredientName}%`);
        }

        const { data: products, error } = await query;

        if (error) {
            console.error('Failed to fetch product mappings:', error);
            return NextResponse.json(
                { error: 'Failed to fetch products' },
                { status: 500 }
            );
        }

        // 配送可能港でフィルタリング
        let filteredProducts = products || [];
        if (deliveryPort) {
            filteredProducts = filteredProducts.filter((p: any) => {
                const supplier = p.Supplier;
                if (!supplier?.deliveryPorts) return false;
                const ports = supplier.deliveryPorts.split(',').map((port: string) => port.trim());
                return ports.includes(deliveryPort);
            });
        }

        return NextResponse.json({ products: filteredProducts });
    } catch (error) {
        console.error('Error in product mapping API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST: 商品に食材をマッピング
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { productId, ingredientId } = body;

        if (!productId) {
            return NextResponse.json(
                { error: 'productId is required' },
                { status: 400 }
            );
        }

        const supabase = await createSupabaseServerClient();

        const { data: product, error } = await supabase
            .from('SupplierProduct')
            .update({ ingredientId: ingredientId || null })
            .eq('id', productId)
            .select()
            .single();

        if (error) {
            console.error('Failed to update product mapping:', error);
            return NextResponse.json(
                { error: 'Failed to update mapping' },
                { status: 500 }
            );
        }

        return NextResponse.json({ product });
    } catch (error) {
        console.error('Error in product mapping update API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
