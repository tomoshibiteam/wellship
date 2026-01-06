import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { DailyMenuClient } from "@/components/daily-menu/daily-menu-client";

export default async function DailyMenuPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'CHEF') {
        redirect('/login');
    }

    // 司厨が担当する船舶を取得
    const membership = await prisma.userVesselMembership.findFirst({
        where: { userId: user.id },
        include: { vessel: true },
    });

    if (!membership) {
        redirect('/planning');
    }

    const vessel = membership.vessel;

    // 全レシピを取得（選択用）
    const recipes = await prisma.recipe.findMany({
        where: { companyId: user.companyId },
        orderBy: [
            { category: 'asc' },
            { name: 'asc' },
        ],
        select: {
            id: true,
            name: true,
            category: true,
            calories: true,
            protein: true,
            salt: true,
            costPerServing: true,
        },
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="毎日の献立管理"
                description="今日の献立を確認・編集"
                badge="当日運用"
            />

            <DailyMenuClient
                vesselId={vessel.id}
                vesselName={vessel.name}
                recipes={recipes}
            />
        </div>
    );
}
