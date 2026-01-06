import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { analyzeLeftoverPhoto, buildMenuContext } from '@/lib/ai/analyze-photo';
import { isGeminiConfigured } from '@/lib/ai/gemini';

/**
 * POST /api/feedback/close-feedback
 * フィードバックを締めて、残食画像をバッチ分析する
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { menuPlanId } = body;

        if (!menuPlanId) {
            return NextResponse.json(
                { error: 'menuPlanIdが必要です' },
                { status: 400 }
            );
        }

        // Gemini設定確認
        if (!isGeminiConfigured()) {
            return NextResponse.json(
                { error: 'Gemini APIが設定されていません' },
                { status: 500 }
            );
        }

        // MenuPlanを取得
        const menuPlan = await prisma.menuPlan.findUnique({
            where: { id: menuPlanId },
            include: {
                recipeLinks: {
                    include: {
                        recipe: true,
                    },
                },
            },
        });

        if (!menuPlan) {
            return NextResponse.json(
                { error: '献立が見つかりません' },
                { status: 404 }
            );
        }

        if (menuPlan.isClosed) {
            return NextResponse.json(
                { error: 'この食事は既に締められています' },
                { status: 400 }
            );
        }

        // 献立コンテキスト作成
        const menuContext = buildMenuContext(
            menuPlan.recipeLinks.map(rl => ({
                name: rl.recipe.name,
                category: rl.recipe.category,
            }))
        );

        // 分析対象のフィードバックを取得
        // 条件: 残食あり (leftover != "none") && 写真あり && 未分析
        const targetFeedbacks = await prisma.mealFeedback.findMany({
            where: {
                menuPlanId,
                leftover: { not: 'none' },
                photoUrl: { not: null },
                aiAnalysisStatus: null,
            },
        });

        // MenuPlanを締める
        await prisma.menuPlan.update({
            where: { id: menuPlanId },
            data: {
                isClosed: true,
                closedAt: new Date(),
            },
        });

        // 分析結果の集計
        const results = {
            total: targetFeedbacks.length,
            success: 0,
            failed: 0,
            skipped: 0,
        };

        // 完食のフィードバックは「skipped」としてマーク
        const completeFeedbacks = await prisma.mealFeedback.findMany({
            where: {
                menuPlanId,
                leftover: 'none',
                aiAnalysisStatus: null,
            },
        });

        for (const feedback of completeFeedbacks) {
            await prisma.mealFeedback.update({
                where: { id: feedback.id },
                data: {
                    aiAnalysisStatus: 'skipped',
                    aiNote: '完食のため分析不要',
                    aiAnalyzedAt: new Date(),
                },
            });
            results.skipped++;
        }

        // 写真なしのフィードバックも「skipped」としてマーク
        const noPhotoFeedbacks = await prisma.mealFeedback.findMany({
            where: {
                menuPlanId,
                leftover: { not: 'none' },
                photoUrl: null,
                aiAnalysisStatus: null,
            },
        });

        for (const feedback of noPhotoFeedbacks) {
            await prisma.mealFeedback.update({
                where: { id: feedback.id },
                data: {
                    aiAnalysisStatus: 'skipped',
                    aiNote: '写真なしのため分析不要',
                    aiAnalyzedAt: new Date(),
                },
            });
            results.skipped++;
        }

        // 対象フィードバックを順次分析（直列実行）
        for (const feedback of targetFeedbacks) {
            try {
                // pendingステータスに更新
                await prisma.mealFeedback.update({
                    where: { id: feedback.id },
                    data: { aiAnalysisStatus: 'pending' },
                });

                // Gemini分析実行
                const analysisResult = await analyzeLeftoverPhoto(
                    feedback.photoUrl!,
                    menuContext
                );

                // 成功結果を保存
                await prisma.mealFeedback.update({
                    where: { id: feedback.id },
                    data: {
                        aiAnalysisStatus: 'success',
                        aiLeftoverPercent: analysisResult.leftoverPercent,
                        aiLeftoverLevel: analysisResult.leftoverLevel,
                        aiConfidence: analysisResult.confidence,
                        aiNote: analysisResult.note,
                        aiAnalyzedAt: new Date(),
                    },
                });

                results.success++;
            } catch (error) {
                console.error(`Failed to analyze feedback ${feedback.id}:`, error);

                // 失敗結果を保存
                await prisma.mealFeedback.update({
                    where: { id: feedback.id },
                    data: {
                        aiAnalysisStatus: 'failed',
                        aiNote: error instanceof Error ? error.message : '分析に失敗しました',
                        aiAnalyzedAt: new Date(),
                    },
                });

                results.failed++;
            }
        }

        return NextResponse.json({
            success: true,
            message: 'フィードバックを締めて分析を完了しました',
            results,
        });
    } catch (error) {
        console.error('Close feedback error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'サーバーエラー' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/feedback/close-feedback?menuPlanId=xxx
 * 分析ステータスを取得
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const menuPlanId = searchParams.get('menuPlanId');

        if (!menuPlanId) {
            return NextResponse.json(
                { error: 'menuPlanIdが必要です' },
                { status: 400 }
            );
        }

        const menuPlan = await prisma.menuPlan.findUnique({
            where: { id: menuPlanId },
            select: {
                isClosed: true,
                closedAt: true,
            },
        });

        if (!menuPlan) {
            return NextResponse.json(
                { error: '献立が見つかりません' },
                { status: 404 }
            );
        }

        // 分析ステータス集計
        const stats = await prisma.mealFeedback.groupBy({
            by: ['aiAnalysisStatus'],
            where: { menuPlanId },
            _count: true,
        });

        const statusCounts: Record<string, number> = {
            pending: 0,
            success: 0,
            failed: 0,
            skipped: 0,
            unanalyzed: 0,
        };

        for (const stat of stats) {
            const status = stat.aiAnalysisStatus || 'unanalyzed';
            statusCounts[status] = stat._count;
        }

        return NextResponse.json({
            isClosed: menuPlan.isClosed,
            closedAt: menuPlan.closedAt,
            stats: statusCounts,
        });
    } catch (error) {
        console.error('Get close feedback status error:', error);
        return NextResponse.json(
            { error: 'サーバーエラー' },
            { status: 500 }
        );
    }
}
