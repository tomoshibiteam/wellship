import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { crewId } = body;

        if (!crewId) {
            return NextResponse.json(
                { error: 'crewId is required' },
                { status: 400 }
            );
        }

        const supabase = await createSupabaseServerClient();

        const { error } = await supabase
            .from('CrewMember')
            .delete()
            .eq('id', crewId);

        if (error) {
            console.error('Failed to delete crew member:', error);
            return NextResponse.json(
                { error: 'Failed to delete crew member' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in crew delete API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
