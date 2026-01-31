import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const vesselId = searchParams.get('vesselId');

        if (!vesselId) {
            return NextResponse.json(
                { error: 'vesselId is required' },
                { status: 400 }
            );
        }

        const supabase = await createSupabaseServerClient();

        const { data: crewMembers, error } = await supabase
            .from('CrewMember')
            .select('id, name, cardCode, vesselId')
            .eq('vesselId', vesselId)
            .order('name', { ascending: true });

        if (error) {
            console.error('Failed to fetch crew members:', error);
            return NextResponse.json(
                { error: 'Failed to fetch crew members' },
                { status: 500 }
            );
        }

        return NextResponse.json({ crewMembers: crewMembers || [] });
    } catch (error) {
        console.error('Error in crew list API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
