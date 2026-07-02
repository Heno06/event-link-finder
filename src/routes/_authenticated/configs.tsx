import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listConfigs, upsertConfig, deleteConfig } from "@/lib/configs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configs")({
  component: Configs,
});

type FormState = {
  id?: string;
  name: string;
  event_spreadsheet_url: string;
  event_tab: string;
  org_spreadsheet_url: string;
  org_tab: string;
  contacts_spreadsheet_url: string;
  contacts_tab: string;
  row_limit: string;
};

const empty: FormState = {
  name: "",
  event_spreadsheet_url: "",
  event_tab: "Sheet1",
  org_spreadsheet_url: "",
  org_tab: "Sheet1",
  contacts_spreadsheet_url: "",
  contacts_tab: "Sheet1",
  row_limit: "",
};

function Configs() {
  const listFn = useServerFn(listConfigs);
  const upsertFn = useServerFn(upsertConfig);
  const delFn = useServerFn(deleteConfig);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["configs"], queryFn: () => listFn() });
  const [form, setForm] = useState<FormState>(empty);

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: form.id,
          name: form.name,
          event_spreadsheet_url: form.event_spreadsheet_url,
          event_tab: form.event_tab,
          org_spreadsheet_url: form.org_spreadsheet_url,
          org_tab: form.org_tab,
          contacts_spreadsheet_url: form.contacts_spreadsheet_url,
          contacts_tab: form.contacts_tab,
          row_limit: form.row_limit ? Number(form.row_limit) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["configs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["configs"] });
    },
  });

  const field = (k: keyof FormState, label: string, extra?: Partial<React.InputHTMLAttributes<HTMLInputElement>>) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurations</h1>
        <p className="text-sm text-muted-foreground">
          Save the sheets you match against. The connected Google account must have access to each sheet.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{form.id ? "Edit configuration" : "New configuration"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {field("name", "Name", { required: true, placeholder: "Spring 2026 event" })}
            {field("row_limit", "Row limit (optional, for test runs)", { type: "number", min: 1 })}
            {field("event_spreadsheet_url", "Event spreadsheet URL", { required: true })}
            {field("event_tab", "Event tab name", { required: true })}
            {field("org_spreadsheet_url", "Organization DB spreadsheet URL", { required: true })}
            {field("org_tab", "Organization DB tab name", { required: true })}
            {field("contacts_spreadsheet_url", "Contacts DB spreadsheet URL", { required: true })}
            {field("contacts_tab", "Contacts DB tab name", { required: true })}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={save.isPending}>
                {form.id ? "Update" : "Create"}
              </Button>
              {form.id && (
                <Button type="button" variant="ghost" onClick={() => setForm(empty)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Saved</h2>
        {(q.data ?? []).map((c: any) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  event · {c.event_tab} · org · {c.org_tab} · contacts · {c.contacts_tab}
                  {c.row_limit ? ` · limit ${c.row_limit}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      id: c.id,
                      name: c.name,
                      event_spreadsheet_url: c.event_spreadsheet_url,
                      event_tab: c.event_tab,
                      org_spreadsheet_url: c.org_spreadsheet_url,
                      org_tab: c.org_tab,
                      contacts_spreadsheet_url: c.contacts_spreadsheet_url,
                      contacts_tab: c.contacts_tab,
                      row_limit: c.row_limit ? String(c.row_limit) : "",
                    })
                  }
                >
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => del.mutate(c.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
