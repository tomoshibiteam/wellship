import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { DashboardFeedbackClient } from "@/components/dashboard-feedback-client";

export default async function FeedbackPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'CHEF') {
        redirect('/login');
    }

    // 司厨が担当する船舶を取得（最初の船舶を自動選択）
    const membership = await prisma.userVesselMembership.findFirst({
        where: { userId: user.id },
        include: { vessel: true },
    });

    if (!membership) {
        return (
            <div className="flex h-full items-center justify-center p-4">
                <div className="max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                    <p className="text-sm text-amber-800">
                        担当船舶が設定されていません。管理者に連絡してください。
                    </p>
                </div>
            </div>
        );
    }

    const vessel = membership.vessel;

    return (
        <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-[0_8px_24px_rgba(14,94,156,0.06)]">
                <DashboardFeedbackClient
                    vesselId={vessel.id}
                    vesselName={vessel.name}
                />
            </div>
        </div>
    );
}
