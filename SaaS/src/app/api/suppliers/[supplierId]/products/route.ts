import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// GET: サプライヤーの商品一覧を取得
export async function GET(
    request: NextRequest,
    { params }: { params: { supplierId: string } }
) {
    try {
        const { supplierId } = params;
        const supabase = await createSupabaseServerClient();

        const { data: products, error } = await supabase
            .from('SupplierProduct')
            .select(`
                id,
                productName,
                productCode,
                description,
                category,
                price,
                unit,
                minOrderQty,
                maxOrderQty,
                isAvailable,
                stockQty,
                leadDays,
                imageUrl,
                ingredientId,
                createdAt,
                Ingredient:ingredientId(id, name)
            `)
            .eq('supplierId', supplierId)
            .order('category', { ascending: true })
            .order('productName', { ascending: true });

        if (error) {
            console.error('Failed to fetch supplier products:', error);
            return NextResponse.json(
                { error: 'Failed to fetch products' },
                { status: 500 }
            );
        }

        return NextResponse.json({ products: products || [] });
    } catch (error) {
        console.error('Error in supplier products API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST: 商品を追加
export async function POST(
    request: NextRequest,
    { params }: { params: { supplierId: string } }
) {
    try {
        const { supplierId } = params;
        const body = await request.json();
        const {
            productName,
            productCode,
            description,
            category,
            price,
            unit,
            minOrderQty,
            maxOrderQty,
            isAvailable,
            leadDays,
            ingredientId,
            imageUrl,
        } = body;

        if (!productName || !price || !unit) {
            return NextResponse.json(
                { error: 'productName, price, and unit are required' },
                { status: 400 }
            );
        }

        const supabase = await createSupabaseServerClient();

        const { data: product, error } = await supabase
            .from('SupplierProduct')
            .insert({
                id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                supplierId,
                productName,
                productCode: productCode || null,
                description: description || null,
                category: category || null,
                price: parseInt(price, 10),
                unit,
                minOrderQty: minOrderQty ?? 1,
                maxOrderQty: maxOrderQty || null,
                isAvailable: isAvailable ?? true,
                leadDays: leadDays ?? 1,
                ingredientId: ingredientId || null,
                imageUrl: imageUrl || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to create product:', error);
            return NextResponse.json(
                { error: 'Failed to create product' },
                { status: 500 }
            );
        }

        return NextResponse.json({ product });
    } catch (error) {
        console.error('Error in product create API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
