import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// PATCH: 商品情報を更新（在庫状態など）
export async function PATCH(
    request: NextRequest,
    { params }: { params: { supplierId: string; productId: string } }
) {
    try {
        const { productId } = params;
        const body = await request.json();
        const { isAvailable, isApproved, price, stockQty } = body;

        const supabase = await createSupabaseServerClient();

        const updateData: any = {};
        if (typeof isAvailable === 'boolean') updateData.isAvailable = isAvailable;
        if (typeof isApproved === 'boolean') updateData.isApproved = isApproved;
        if (typeof price === 'number') updateData.price = price;
        if (typeof stockQty === 'number') updateData.stockQty = stockQty;

        const { data: product, error } = await supabase
            .from('SupplierProduct')
            .update(updateData)
            .eq('id', productId)
            .select()
            .single();

        if (error) {
            console.error('Failed to update product:', error);
            return NextResponse.json(
                { error: 'Failed to update product' },
                { status: 500 }
            );
        }

        return NextResponse.json({ product });
    } catch (error) {
        console.error('Error in product update API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
