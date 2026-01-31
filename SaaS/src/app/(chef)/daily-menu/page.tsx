import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/manager/manager-ui";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DailyMenuClient } from "@/components/daily-menu/daily-menu-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DailyMenuPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'CHEF') {
        redirect('/login');
    }

    const vesselId = user.vesselIds?.[0];
    if (!vesselId) {
        return (
            <EmptyState
                title="担当船舶が未登録です"
                description="会社/船舶が登録されていないため、献立を表示できません。管理者に連絡してください。"
            />
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
            <EmptyState
                title="担当船舶が見つかりません"
                description="船舶の登録状況を確認してください。"
            />
        );
    }

    // 全レシピを取得（選択用）
    const { data: recipes } = await supabase
        .from("Recipe")
        .select("id,name,category,calories,protein,salt,costPerServing")
        .eq("companyId", user.companyId)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

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
                recipes={recipes ?? []}
            />
        </div>
    );
}
