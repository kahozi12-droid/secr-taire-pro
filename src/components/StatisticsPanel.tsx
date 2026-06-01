import { useEffect, useMemo, useState } from "react";
import { format, startOfWeek, startOfMonth, subWeeks, subMonths, addWeeks, addMonths } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocRow {
  id: string;
  type: "incoming" | "outgoing";
  status: "pending" | "processed" | "archived";
  sender: string | null;
  recipient: string | null;
  category_main: string;
  document_date: string;
  created_at: string;
}

const STORAGE_KEY = "stats.lastRefresh";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 200 70% 50%))", "hsl(var(--chart-3, 30 80% 55%))", "hsl(var(--chart-4, 280 60% 55%))", "hsl(var(--chart-5, 150 60% 45%))"];

export function StatisticsPanel() {
  const { t, lang } = useI18n();
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(() => Number(localStorage.getItem(STORAGE_KEY)) || 0);

  const load = async () => {
    const { data } = await supabase
      .from("documents")
      .select("id,type,status,sender,recipient,category_main,document_date,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    setDocs((data ?? []) as DocRow[]);
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, String(now));
    setLastRefresh(now);
  };

  useEffect(() => {
    const stale = !lastRefresh || Date.now() - lastRefresh > WEEK_MS;
    if (stale) load();
    else {
      // still load once for current session
      load();
    }
    // eslint-disable-next-line
  }, []);

  const weeklyTrend = useMemo(() => {
    if (!docs) return [];
    const buckets = new Map<string, { week: string; incoming: number; outgoing: number; processed: number }>();
    const start = startOfWeek(subWeeks(new Date(), 11), { weekStartsOn: 1 });
    for (let i = 0; i < 12; i++) {
      const d = addWeeks(start, i);
      const k = format(d, "yyyy-MM-dd");
      buckets.set(k, { week: format(d, "dd MMM"), incoming: 0, outgoing: 0, processed: 0 });
    }
    docs.forEach((d) => {
      const wk = startOfWeek(new Date(d.created_at), { weekStartsOn: 1 });
      const k = format(wk, "yyyy-MM-dd");
      const b = buckets.get(k);
      if (!b) return;
      if (d.type === "incoming") b.incoming++;
      else b.outgoing++;
      if (d.status === "processed" || d.status === "archived") b.processed++;
    });
    return Array.from(buckets.values());
  }, [docs]);

  const monthlyTrend = useMemo(() => {
    if (!docs) return [];
    const buckets = new Map<string, { month: string; incoming: number; outgoing: number }>();
    const start = startOfMonth(subMonths(new Date(), 5));
    for (let i = 0; i < 6; i++) {
      const d = addMonths(start, i);
      const k = format(d, "yyyy-MM");
      buckets.set(k, { month: format(d, "MMM yy"), incoming: 0, outgoing: 0 });
    }
    docs.forEach((d) => {
      const k = format(startOfMonth(new Date(d.created_at)), "yyyy-MM");
      const b = buckets.get(k);
      if (!b) return;
      if (d.type === "incoming") b.incoming++;
      else b.outgoing++;
    });
    return Array.from(buckets.values());
  }, [docs]);

  const topSenders = useMemo(() => {
    if (!docs) return [];
    const m = new Map<string, number>();
    docs.filter((d) => d.type === "incoming" && d.sender).forEach((d) => {
      m.set(d.sender!, (m.get(d.sender!) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 24 ? name.slice(0, 24) + "…" : name, count }));
  }, [docs]);

  const statusDist = useMemo(() => {
    if (!docs) return [];
    const counts = { pending: 0, processed: 0, archived: 0 };
    docs.forEach((d) => { counts[d.status]++; });
    return [
      { name: t("statusPending"), value: counts.pending },
      { name: t("statusProcessed"), value: counts.processed },
      { name: t("statusArchived"), value: counts.archived },
    ];
  }, [docs, t]);

  const categoryDist = useMemo(() => {
    if (!docs) return [];
    const m = new Map<string, number>();
    docs.filter((d) => d.type === "incoming").forEach((d) => {
      m.set(d.category_main, (m.get(d.category_main) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [docs]);

  const suggestions = useMemo(() => {
    if (!docs) return [];
    const out: string[] = [];
    const pending = docs.filter((d) => d.status === "pending").length;
    const totalIn = docs.filter((d) => d.type === "incoming").length;
    const totalOut = docs.filter((d) => d.type === "outgoing").length;

    if (pending > 10) {
      out.push(
        lang === "fr"
          ? `${pending} documents en attente : envisagez de planifier une session de traitement cette semaine.`
          : `${pending} documents pending: consider scheduling a processing session this week.`,
      );
    }
    const lastWeek = weeklyTrend[weeklyTrend.length - 1];
    const prevWeek = weeklyTrend[weeklyTrend.length - 2];
    if (lastWeek && prevWeek) {
      const lastTotal = lastWeek.incoming + lastWeek.outgoing;
      const prevTotal = prevWeek.incoming + prevWeek.outgoing;
      if (prevTotal > 0 && lastTotal > prevTotal * 1.3) {
        out.push(
          lang === "fr"
            ? `Hausse de ${Math.round(((lastTotal - prevTotal) / prevTotal) * 100)}% du volume cette semaine vs la précédente.`
            : `${Math.round(((lastTotal - prevTotal) / prevTotal) * 100)}% volume increase this week vs last week.`,
        );
      }
      if (prevTotal > 0 && lastTotal < prevTotal * 0.5) {
        out.push(
          lang === "fr"
            ? `Baisse marquée du volume cette semaine — vérifiez que tous les scans sont bien classés.`
            : `Sharp drop in volume this week — verify all scans are classified.`,
        );
      }
    }
    if (topSenders[0] && topSenders[0].count > 5) {
      out.push(
        lang === "fr"
          ? `${topSenders[0].name} est votre expéditeur le plus fréquent (${topSenders[0].count} courriers). Créez un raccourci de classement.`
          : `${topSenders[0].name} is your top sender (${topSenders[0].count} items). Create a classification shortcut.`,
      );
    }
    if (totalIn > 0 && totalOut / totalIn < 0.3) {
      out.push(
        lang === "fr"
          ? `Beaucoup d'arrivées (${totalIn}) pour peu de départs (${totalOut}) : pensez aux réponses en attente.`
          : `Many incoming (${totalIn}) for few outgoing (${totalOut}): check pending replies.`,
      );
    }
    if (out.length === 0) {
      out.push(
        lang === "fr"
          ? "Activité stable. Continuez le bon travail !"
          : "Activity is stable. Keep up the good work!",
      );
    }
    return out;
  }, [docs, weeklyTrend, topSenders, lang]);

  if (!docs) {
    return <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {lang === "fr" ? "Mis à jour" : "Updated"}: {lastRefresh ? format(new Date(lastRefresh), "dd MMM yyyy HH:mm") : "—"}
          <Badge variant="secondary" className="ml-2">
            {lang === "fr" ? "Actualisation hebdomadaire" : "Weekly refresh"}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> {lang === "fr" ? "Actualiser" : "Refresh"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{lang === "fr" ? "Tendance hebdomadaire (12 sem.)" : "Weekly trend (12 weeks)"}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="week" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="incoming" name={t("incoming")} stroke={COLORS[0]} strokeWidth={2} />
                <Line type="monotone" dataKey="outgoing" name={t("outgoing")} stroke={COLORS[1]} strokeWidth={2} />
                <Line type="monotone" dataKey="processed" name={t("treated")} stroke={COLORS[2]} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{lang === "fr" ? "Tendance mensuelle (6 mois)" : "Monthly trend (6 months)"}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="incoming" name={t("incoming")} fill={COLORS[0]} />
                <Bar dataKey="outgoing" name={t("outgoing")} fill={COLORS[1]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{lang === "fr" ? "Top expéditeurs" : "Top senders"}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {topSenders.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">—</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSenders} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS[3]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{lang === "fr" ? "Répartition par statut" : "Status distribution"}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
                  {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{lang === "fr" ? "Catégories d'arrivée" : "Incoming categories"}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {categoryDist.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">—</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryDist}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS[4]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-primary" />
            {lang === "fr" ? "Suggestions" : "Suggestions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {suggestions.map((s, i) => (
              <li key={i} className="flex gap-2 rounded-md border border-border bg-muted/20 p-3">
                <span className="text-primary">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
