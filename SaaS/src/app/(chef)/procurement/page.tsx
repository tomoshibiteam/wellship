import { PageHeader } from "@/components/page-header";
import ProcurementGenerator from "./procurement-generator";
import { loadDefaultStartDate } from "./actions";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/manager/manager-ui";

export default async function ProcurementPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHEF") {
    redirect("/login");
  }
  const vesselId = user.vesselIds?.[0];
  if (!vesselId) {
    return (
      <EmptyState
        title="担当船舶が未登録です"
        description="会社/船舶が登録されていないため、調達リストを表示できません。管理者に連絡してください。"
      />
    );
  }

  const defaultStartDate = await loadDefaultStartDate();
  return (
    <div className="space-y-6">
      <PageHeader
        title="調達リスト"
        description="最新の献立（/planning で生成・差し替えた内容）から必要食材の合計量と概算コストを算出します。"
        badge="画面B"
      />
      <ProcurementGenerator initialStartDate={defaultStartDate} vesselId={vesselId} />
    </div>
  );
}
