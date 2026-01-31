import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// GET: サプライヤー一覧を取得
export async function GET() {
    try {
        const supabase = await createSupabaseServerClient();

        const { data: suppliers, error } = await supabase
            .from('Supplier')
            .select('id, name, code, email, phone, address, isActive, deliveryPorts, createdAt')
            .eq('isActive', true)
            .order('name', { ascending: true });

        if (error) {
            console.error('Failed to fetch suppliers:', error);
            return NextResponse.json(
                { error: 'Failed to fetch suppliers' },
                { status: 500 }
            );
        }

        // deliveryPorts を配列に変換
        const formattedSuppliers = (suppliers || []).map(s => ({
            ...s,
            deliveryPorts: s.deliveryPorts ? s.deliveryPorts.split(',').map((p: string) => p.trim()) : [],
        }));

        return NextResponse.json({ suppliers: formattedSuppliers });
    } catch (error) {
        console.error('Error in suppliers list API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST: 新規サプライヤーを追加
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, code, email, phone, address, deliveryPorts } = body;

        if (!name || !code) {
            return NextResponse.json(
                { error: 'name and code are required' },
                { status: 400 }
            );
        }

        const supabase = await createSupabaseServerClient();

        const { data: supplier, error } = await supabase
            .from('Supplier')
            .insert({
                id: `supplier-${Date.now()}`,
                name,
                code,
                email: email || null,
                phone: phone || null,
                address: address || null,
                deliveryPorts: Array.isArray(deliveryPorts) ? deliveryPorts.join(',') : deliveryPorts || null,
                isActive: true,
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to create supplier:', error);
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'サプライヤーコードが既に存在します' },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { error: 'Failed to create supplier' },
                { status: 500 }
            );
        }

        return NextResponse.json({ supplier });
    } catch (error) {
        console.error('Error in supplier create API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
