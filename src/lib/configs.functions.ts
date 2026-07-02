import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ConfigInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  event_spreadsheet_url: z.string().url(),
  event_tab: z.string().min(1).max(120),
  org_spreadsheet_url: z.string().url(),
  org_tab: z.string().min(1).max(120),
  contacts_spreadsheet_url: z.string().url(),
  contacts_tab: z.string().min(1).max(120),
  row_limit: z.number().int().positive().nullable().optional(),
});

export const listConfigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sheet_configs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfigInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, updated_at: new Date().toISOString() };
    if (data.id) {
      const { error } = await context.supabase
        .from("sheet_configs")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("sheet_configs")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sheet_configs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
