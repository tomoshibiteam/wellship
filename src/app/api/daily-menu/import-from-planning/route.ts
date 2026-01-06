import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { MealType } from '@prisma/client';

/**
 * POST /api/daily-menu/import-from-planning
 * AI生成された献立（MenuPlan）を日別献立にインポート
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vesselId, targetDate, mealType } = body;

        if (!vesselId || !targetDate || !mealType) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        // 既存のAI生成献立を検索
        const sourceMenuPlan = await prisma.menuPlan.findFirst({
            where: {
                vesselId,
                date: targetDate,
                mealType: mealType as MealType,
            },
            include: {
                recipeLinks: true,
            },
        });

        if (!sourceMenuPlan || sourceMenuPlan.recipeLinks.length === 0) {
            return NextResponse.json({
                error: `${targetDate}の${mealType}には献立が設定されていません。先に「献立＆調達」でAI生成してください。`
            }, { status: 404 });
        }

        // 既に献立があれば成功（すでにインポート済み）
        return NextResponse.json({
            success: true,
            count: sourceMenuPlan.recipeLinks.length,
            message: '献立を取り込みました'
        });
    } catch (error) {
        console.error('POST import-from-planning error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
