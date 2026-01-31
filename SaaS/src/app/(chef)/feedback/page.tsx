import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DashboardFeedbackClient } from "@/components/dashboard-feedback-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/manager/manager-ui";

export default async function FeedbackPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'CHEF') {
        redirect('/login');
    }

    const vesselId = user.vesselIds?.[0];
    if (!vesselId) {
        return (
            <div className="p-4">
                <EmptyState
                    title="担当船舶が未登録です"
                    description="会社/船舶が登録されていないため、フィードバック画面を表示できません。管理者に連絡してください。"
                />
            </div>
        );
    }

    const supabase = await createSupabaseServerClient();
    const { data: vessel } = await supabase
        .from("Vessel")
        .select("id,name")
        .eq("id", vesselId)
        .eq("companyId", user.companyId)
        .maybeSingle();

    if (!vessel) {
        return (
            <div className="p-4">
                <EmptyState
                    title="担当船舶が見つかりません"
                    description="船舶の登録状況を確認してください。"
                />
            </div>
        );
    }

    return (
        <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <DashboardFeedbackClient
                    vesselId={vessel.id}
                    vesselName={vessel.name}
                />
            </div>
        </div>
    );
}
