import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DailyMenuClient } from "@/components/daily-menu/daily-menu-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DailyMenuPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'CHEF') {
        redirect('/login');
    }

    // 司厨が担当する船舶を取得
    const supabase = await createSupabaseServerClient();
    const { data: membership } = await supabase
        .from("UserVesselMembership")
        .select("vessel:Vessel(id,name)")
        .eq("userId", user.id)
        .maybeSingle();

    if (!membership) {
        redirect('/planning');
    }

    const vessel = Array.isArray(membership.vessel)
        ? membership.vessel[0]
        : membership.vessel;

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
                vesselId={vessel?.id ?? ""}
                vesselName={vessel?.name ?? ""}
                recipes={recipes ?? []}
            />
        </div>
    );
}
