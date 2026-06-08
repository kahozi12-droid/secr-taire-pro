import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatisticsPanel } from "@/components/StatisticsPanel";

export const Route = createFileRoute("/_app/activity")({
  component: ActivityPage,
});

interface ActivityRow { id: string; action: string; entity_type: string | null; entity_id: string | null; details: unknown; created_at: string; user_id: string | null }

function ActivityPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200);
      setRows((data ?? []) as ActivityRow[]);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("activity")}</h1>
        <p className="text-sm text-muted-foreground">
          {lang === "fr" ? "Historique et statistiques de l'activité" : "Activity history and statistics"}
        </p>
      </div>

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">{t("recentActivity")}</TabsTrigger>
          <TabsTrigger value="stats">{lang === "fr" ? "Statistiques" : "Statistics"}</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-2">
          <p className="text-sm text-muted-foreground">{rows ? `${rows.length} ${t("recentActivity").toLowerCase()}` : t("loading")}</p>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left whitespace-nowrap">{t("date")}</th>
                  <th className="px-3 py-2 text-left">{t("actions")}</th>
                  <th className="px-3 py-2 text-left">{t("type")}</th>
                  <th className="px-3 py-2 text-left">{t("code")}</th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((r) => {
                  const det = (r.details ?? {}) as { reference_code?: string; title?: string; from?: string; to?: string };
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</td>
                      <td className="px-3 py-2">{r.action}{det.from && det.to && <span className="ml-1 text-xs text-muted-foreground">({det.from} → {det.to})</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.entity_type ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{det.reference_code ?? "—"}</td>
                    </tr>
                  );
                })}
                {rows?.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">—</td></tr>}
              </tbody>
            </table>
          </div>

        </TabsContent>

        <TabsContent value="stats">
          <StatisticsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
