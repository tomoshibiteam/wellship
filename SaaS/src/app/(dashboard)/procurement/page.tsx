import { PageHeader } from "@/components/page-header";
import ProcurementGenerator from "./procurement-generator";
import { loadDefaultStartDate } from "./actions";

export default async function ProcurementPage() {
  const defaultStartDate = await loadDefaultStartDate();
  return (
    <div className="space-y-6">
      <PageHeader
        title="調達リスト"
        description="最新の献立（/planning で生成・差し替えた内容）から必要食材の合計量と概算コストを算出します。"
        badge="画面B"
      />
      <ProcurementGenerator initialStartDate={defaultStartDate} />
    </div>
  );
}
