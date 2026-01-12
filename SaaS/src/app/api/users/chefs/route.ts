import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: chefs, error } = await supabase
    .from("User")
    .select("id,email,name,role")
    .eq("companyId", user.companyId)
    .eq("role", "CHEF")
    .order("email", { ascending: true });

  if (error) {
    console.error("Failed to load chefs", error);
    return NextResponse.json({ error: "司厨一覧の取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ chefs: chefs ?? [] });
}
