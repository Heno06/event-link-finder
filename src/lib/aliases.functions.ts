import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAliases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("org_aliases")
      .select("*")
      .order("alias", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        alias: z.string().min(1).max(300),
        canonical_name: z.string().max(300).nullable().optional(),
        record_id: z.string().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("org_aliases")
        .update({
          alias: data.alias,
          canonical_name: data.canonical_name ?? null,
          record_id: data.record_id ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("org_aliases")
      .insert({
        alias: data.alias,
        canonical_name: data.canonical_name ?? null,
        record_id: data.record_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("org_aliases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearCache = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("org_match_cache")
      .delete()
      .not("id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
