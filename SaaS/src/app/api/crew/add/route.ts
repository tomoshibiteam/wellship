import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Generate a unique card code for crew members
function generateCardCode(vesselName: string, crewName: string): string {
    const timestamp = Date.now().toString(36).slice(-4);
    const nameSlug = crewName.slice(0, 3).toUpperCase();
    return `CREW-${nameSlug}-${timestamp}`;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vesselId, name } = body;

        if (!vesselId || !name) {
            return NextResponse.json(
                { error: 'vesselId and name are required' },
                { status: 400 }
            );
        }

        const supabase = await createSupabaseServerClient();

        // Get vessel name for card code generation
        const { data: vessel } = await supabase
            .from('Vessel')
            .select('name')
            .eq('id', vesselId)
            .single();

        const cardCode = generateCardCode(vessel?.name || 'VESSEL', name);

        const { data: crewMember, error } = await supabase
            .from('CrewMember')
            .insert({
                name,
                cardCode,
                vesselId,
            })
            .select('id, name, cardCode, vesselId')
            .single();

        if (error) {
            console.error('Failed to add crew member:', error);
            return NextResponse.json(
                { error: 'Failed to add crew member' },
                { status: 500 }
            );
        }

        return NextResponse.json({ crewMember });
    } catch (error) {
        console.error('Error in crew add API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
