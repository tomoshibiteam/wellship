import { PageHeader } from "@/components/page-header";
import FeedbackEntryForm from "./form";

export default function FeedbackEntryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="喫食フィードバック入力"
        description="タブレットで30秒以内に回答できるシンプルなフィードバックフォームです。"
        badge="画面C"
      />

      <FeedbackEntryForm />
    </div>
  );
}
