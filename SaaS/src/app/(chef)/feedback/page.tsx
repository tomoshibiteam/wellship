import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DashboardFeedbackClient } from "@/components/dashboard-feedback-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function FeedbackPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'CHEF') {
        redirect('/login');
    }

    // 司厨が担当する船舶を取得（最初の船舶を自動選択）
    const supabase = await createSupabaseServerClient();
    const { data: membership } = await supabase
        .from("UserVesselMembership")
        .select("vessel:Vessel(id,name)")
        .eq("userId", user.id)
        .maybeSingle();

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

    const vessel = Array.isArray(membership.vessel)
        ? membership.vessel[0]
        : membership.vessel;

    return (
        <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-[0_8px_24px_rgba(14,94,156,0.06)]">
                <DashboardFeedbackClient
                    vesselId={vessel?.id ?? ""}
                    vesselName={vessel?.name ?? ""}
                />
            </div>
        </div>
    );
}
