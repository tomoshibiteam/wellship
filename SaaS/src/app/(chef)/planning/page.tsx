import { PageHeader } from "@/components/page-header";
import { UnifiedPlanningClient } from "./unified-planning-client";
import { getLatestPlanRange, loadExistingPlan } from "./actions";
import { loadDefaultStartDate } from "../procurement/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/manager/manager-ui";
import { redirect } from "next/navigation";

export default async function PlanningPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHEF") {
    redirect("/login");
  }

  const vesselId = user.vesselIds?.[0];
  if (!vesselId) {
    return (
      <EmptyState
        title="担当船舶が未登録です"
        description="会社/船舶が登録されていないため、献立・調達機能を表示できません。管理者に連絡してください。"
      />
    );
  }

  // Vessel設定を取得（季節・調理時間のデフォルト値）
  const supabase = await createSupabaseServerClient();
  const { data: vesselSettings } = await supabase
    .from("Vessel")
    .select("defaultSeason,defaultMaxCookingTime")
    .eq("id", vesselId)
    .eq("companyId", user.companyId)
    .maybeSingle();

  if (!vesselSettings) {
    return (
      <EmptyState
        title="担当船舶が見つかりません"
        description="船舶の登録状況を確認してください。"
      />
    );
  }

  const [initialPlan, latestRange, defaultProcurementStartDate] = await Promise.all([
    loadExistingPlan(),
    getLatestPlanRange(),
    loadDefaultStartDate(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="献立＆調達"
        description="AI献立生成から食材調達まで、一元管理できる画面です。"
        badge="統合ビュー"
      />
      <UnifiedPlanningClient
        initialPlan={initialPlan}
        latestRange={latestRange}
        vesselId={vesselId}
        defaultProcurementStartDate={defaultProcurementStartDate}
        vesselSettings={{
          defaultSeason: vesselSettings.defaultSeason ?? null,
          defaultMaxCookingTime: vesselSettings.defaultMaxCookingTime ?? null,
        }}
      />
    </div>
  );
}
