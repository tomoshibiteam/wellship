import { PageHeader } from "@/components/page-header";
import SummaryClient from "./summary-client";
import { prisma } from "@/lib/db/prisma";

async function loadDefaultRange() {
  const latest = await prisma.mealFeedback.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const earliest = await prisma.mealFeedback.findFirst({
    orderBy: { date: "asc" },
    select: { date: true },
  });
  if (!latest?.date) {
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: today, endDate: today };
  }
  const end = new Date(latest.date);
  const start = new Date(latest.date);
  start.setDate(end.getDate() - 6);
  const minDate = earliest?.date ? new Date(earliest.date) : start;
  if (start < minDate) {
    start.setTime(minDate.getTime());
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export default async function FeedbackInsightsPage() {
  const defaultRange = await loadDefaultRange();
  return (
    <div className="space-y-6">
      <PageHeader
        title="フィードバック集計"
        description="いつもありがとうございます。最近のフィードバックをサマリーで確認し、次の献立づくりに活かしましょう。"
        badge="画面D"
      />
      <SummaryClient defaultRange={defaultRange} />
    </div>
  );
}
