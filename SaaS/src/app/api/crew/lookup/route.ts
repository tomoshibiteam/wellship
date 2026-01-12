import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const cardCode = body?.cardCode as string | undefined;

        if (!cardCode) {
            return NextResponse.json(
                { error: 'カードコードが指定されていません。' },
                { status: 400 }
            );
        }

        const supabase = await createSupabaseServerClient();
        const { data: crewMember } = await supabase
            .from('CrewMember')
            .select('id,name,vesselId,vessel:Vessel(name)')
            .eq('cardCode', cardCode)
            .maybeSingle();

        if (!crewMember) {
            return NextResponse.json(
                { error: 'カードが認識できませんでした。' },
                { status: 404 }
            );
        }

        return NextResponse.json({ crewMember });
    } catch (error) {
        console.error('crew lookup error', error);
        return NextResponse.json(
            { error: '船員情報の取得に失敗しました。' },
            { status: 500 }
        );
    }
}
