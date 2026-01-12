import { PageHeader } from "@/components/page-header";
import { UnifiedPlanningClient } from "./unified-planning-client";
import { getLatestPlanRange, loadExistingPlan } from "./actions";
import { loadDefaultStartDate } from "../procurement/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PlanningPage() {
  const user = await getCurrentUser();
  const initialPlan = await loadExistingPlan();
  const latestRange = await getLatestPlanRange();
  const defaultProcurementStartDate = await loadDefaultStartDate();

  const vesselId = user?.vesselIds?.[0] ?? "";

  // Vessel設定を取得（季節・調理時間のデフォルト値）
  const vesselSettings = vesselId
    ? await (async () => {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("Vessel")
        .select("defaultSeason,defaultMaxCookingTime")
        .eq("id", vesselId)
        .maybeSingle();
      return data ?? null;
    })()
    : null;

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
          defaultSeason: vesselSettings?.defaultSeason ?? null,
          defaultMaxCookingTime: vesselSettings?.defaultMaxCookingTime ?? null,
        }}
      />
    </div>
  );
}
