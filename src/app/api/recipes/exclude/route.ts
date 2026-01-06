import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipeId, scope, reason, vesselId } = body;

    if (!recipeId || !scope || !reason) {
        return NextResponse.json(
            { error: 'recipeId, scope, and reason are required' },
            { status: 400 }
        );
    }

    if (!['CHEF', 'VESSEL'].includes(scope)) {
        return NextResponse.json(
            { error: 'scope must be CHEF or VESSEL' },
            { status: 400 }
        );
    }

    try {
        const data: {
            recipeId: string;
            scope: 'CHEF' | 'VESSEL';
            reason: string;
            userId?: string;
            vesselId?: string;
        } = {
            recipeId,
            scope: scope as 'CHEF' | 'VESSEL',
            reason,
        };

        if (scope === 'CHEF') {
            data.userId = session.user.id;
        } else if (scope === 'VESSEL') {
            if (!vesselId) {
                return NextResponse.json(
                    { error: 'vesselId is required for VESSEL scope' },
                    { status: 400 }
                );
            }
            data.vesselId = vesselId;
        }

        // upsertで重複を防ぐ
        const exclusion = await prisma.recipeExclusion.upsert({
            where: scope === 'CHEF'
                ? { recipeId_userId_scope: { recipeId, userId: session.user.id, scope: 'CHEF' } }
                : { recipeId_vesselId_scope: { recipeId, vesselId, scope: 'VESSEL' } },
            create: data,
            update: { reason },
        });

        return NextResponse.json({ success: true, exclusion });
    } catch (error) {
        console.error('Exclusion error:', error);
        return NextResponse.json(
            { error: 'Failed to create exclusion' },
            { status: 500 }
        );
    }
}

// 除外一覧取得
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get('vesselId');

    const whereConditions = [];
    whereConditions.push({ userId: session.user.id, scope: 'CHEF' as const });
    if (vesselId) {
        whereConditions.push({ vesselId, scope: 'VESSEL' as const });
    }

    const exclusions = await prisma.recipeExclusion.findMany({
        where: { OR: whereConditions },
        include: { recipe: true },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ exclusions });
}
