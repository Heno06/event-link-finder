import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listConfigs } from "@/lib/configs.functions";
import { runContactMatching, runOrgMatching, getRun } from "@/lib/matching.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const listConfigsFn = useServerFn(listConfigs);
  const runContactFn = useServerFn(runContactMatching);
  const runOrgFn = useServerFn(runOrgMatching);
  const getRunFn = useServerFn(getRun);
  const qc = useQueryClient();

  const configsQ = useQuery({ queryKey: ["configs"], queryFn: () => listConfigsFn() });
  const [configId, setConfigId] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);

  const runQ = useQuery({
    queryKey: ["run", runId],
    queryFn: () => getRunFn({ data: { id: runId! } }),
    enabled: !!runId,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status;
      return s === "running" ? 1000 : false;
    },
  });

  const contactM = useMutation({
    mutationFn: () => runContactFn({ data: { configId } }),
    onSuccess: (d) => {
      setRunId(d.runId);
      toast.success(`Matched ${d.matched}/${d.processed}`);
      qc.invalidateQueries({ queryKey: ["run"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const orgM = useMutation({
    mutationFn: () => runOrgFn({ data: { configId } }),
    onSuccess: (d) => {
      setRunId(d.runId);
      toast.success(`Matched ${d.matched}/${d.processed}`);
      qc.invalidateQueries({ queryKey: ["run"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  // Auto-select first config
  useEffect(() => {
    if (!configId && configsQ.data && configsQ.data.length > 0) {
      setConfigId(configsQ.data[0].id);
    }
  }, [configsQ.data, configId]);

  const configs = configsQ.data ?? [];
  const activeCfg = configs.find((c: any) => c.id === configId);
  const run = runQ.data as any;
  const running = contactM.isPending || orgM.isPending || run?.status === "running";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Pick a saved configuration and run a match.</p>
      </div>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-muted-foreground">No configurations yet.</p>
            <Button asChild>
              <Link to="/configs">Create your first configuration</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Choose which sheets to match.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={configId} onValueChange={setConfigId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeCfg && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Event: {activeCfg.event_tab}</div>
                  <div>Org DB: {activeCfg.org_tab}</div>
                  <div>Contacts DB: {activeCfg.contacts_tab}</div>
                  {activeCfg.row_limit && <div>Row limit: {activeCfg.row_limit}</div>}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={() => contactM.mutate()} disabled={!configId || running}>
                  Run Contact Matching
                </Button>
                <Button onClick={() => orgM.mutate()} disabled={!configId || running} variant="secondary">
                  Run Organization Matching
                </Button>
              </div>
            </CardContent>
          </Card>

          {run && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {run.run_type === "contact" ? "Contact" : "Organization"} run — {run.status}
                </CardTitle>
                <CardDescription>
                  {run.processed}/{run.total ?? "…"} processed · {run.matched} matched
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {run.total ? (
                  <Progress value={(run.processed / run.total) * 100} />
                ) : null}
                {run.error && <p className="text-sm text-destructive">{run.error}</p>}
                {run.status === "done" && activeCfg && (
                  <a
                    href={activeCfg.event_spreadsheet_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline"
                  >
                    Open the event sheet ↗
                  </a>
                )}
                {run.status === "done" && Array.isArray(run.unmatched) && run.unmatched.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-sm font-medium">Unmatched ({run.unmatched.length})</h4>
                    <div className="mt-2 max-h-80 overflow-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr className="text-left">
                            <th className="p-2">Row</th>
                            <th className="p-2">Value</th>
                            {run.run_type === "org" && <th className="p-2">Top candidates</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {run.unmatched.map((u: any, i: number) => (
                            <tr key={i} className="border-t">
                              <td className="p-2 tabular-nums">{u.row}</td>
                              <td className="p-2">
                                {u.name || [u.email, u.phone].filter(Boolean).join(" · ")}
                              </td>
                              {run.run_type === "org" && (
                                <td className="p-2 text-muted-foreground">
                                  {(u.topCandidates ?? [])
                                    .map((c: any) => `${c.name} (${c.score})`)
                                    .join(" · ")}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
