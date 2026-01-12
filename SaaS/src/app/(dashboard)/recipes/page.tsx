import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { RecipesClient } from "./recipes-client";

export default async function RecipesPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== "CHEF" && user.role !== "MANAGER")) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="レシピ一覧"
        description="AI献立生成に利用するレシピマスタを一覧で確認できます。"
        badge="管理"
      />
      <RecipesClient />
    </div>
  );
}
