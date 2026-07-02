import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAliases, upsertAlias, deleteAlias, clearCache } from "@/lib/aliases.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const listFn = useServerFn(listAliases);
  const upsertFn = useServerFn(upsertAlias);
  const delFn = useServerFn(deleteAlias);
  const clearFn = useServerFn(clearCache);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["aliases"], queryFn: () => listFn() });
  const [alias, setAlias] = useState("");
  const [canonical, setCanonical] = useState("");
  const [recordId, setRecordId] = useState("");

  const add = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          alias,
          canonical_name: canonical || null,
          record_id: recordId || null,
        },
      }),
    onSuccess: () => {
      setAlias("");
      setCanonical("");
      setRecordId("");
      toast.success("Added");
      qc.invalidateQueries({ queryKey: ["aliases"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aliases"] }),
  });

  const clear = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => toast.success("Match cache cleared"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Alias map and organization match cache.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization aliases</CardTitle>
          <CardDescription>
            Map an input name (as it appears in the event sheet) to a canonical org name OR a Record ID.
            Record ID wins if both are provided.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
            className="grid grid-cols-1 gap-3 md:grid-cols-4"
          >
            <div className="space-y-1.5 md:col-span-2">
              <Label>Alias (input name)</Label>
              <Input value={alias} required onChange={(e) => setAlias(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Canonical name (optional)</Label>
              <Input value={canonical} onChange={(e) => setCanonical(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Record ID (optional)</Label>
              <Input value={recordId} onChange={(e) => setRecordId(e.target.value)} />
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={add.isPending}>
                Add alias
              </Button>
            </div>
          </form>

          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Alias</th>
                  <th className="p-2">Canonical</th>
                  <th className="p-2">Record ID</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {(q.data ?? []).map((a: any) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">{a.alias}</td>
                    <td className="p-2 text-muted-foreground">{a.canonical_name ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{a.record_id ?? "—"}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => del.mutate(a.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {(q.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-xs text-muted-foreground">
                      No aliases yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Match cache</CardTitle>
          <CardDescription>
            Fuzzy and AI matches are cached so future runs are instant. Clear it to re-derive from scratch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => clear.mutate()} disabled={clear.isPending}>
            Clear org match cache
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
