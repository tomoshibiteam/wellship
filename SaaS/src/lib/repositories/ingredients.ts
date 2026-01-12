import { Ingredient } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAllIngredients(): Promise<Ingredient[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("Ingredient")
    .select("id,name,storageType,unit")
    .order("name", { ascending: true });

  if (error || !data) {
    console.error("Failed to load ingredients", error);
    return [];
  }

  return data as Ingredient[];
}
