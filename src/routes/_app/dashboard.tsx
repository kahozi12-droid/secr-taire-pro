import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Inbox, Send, Clock, CheckCircle2, BookOpen, FileBarChart, Printer, FolderOpen, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/providers/AuthProvider";
import { CategoryBadge } from "@/components/CategoryPicker";
import { PRINTERS } from "@/lib/printers";
import { usePrinterFolderStatus } from "@/lib/printerStatus";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

interface DaySummary {
  incoming: number;
  outgoing: number;
  processed: number;
  pending: number;
}

interface Stats {
  incoming: number;
  outgoing: number;
  pending: number;
  processedToday: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  to,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  accent: string;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md"
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      {body}
    </div>
  );
}

function Dashboard() {
  const { t, lang } = useI18n();
  const { role, fullName } = useAuth();
  const folderStatus = usePrinterFolderStatus();
  const directorLinked = !!folderStatus.director;
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Array<{ id: string; reference_code: string; title: string; type: string; category_sub: string; created_at: string }>>([]);
  const [activity, setActivity] = useState<Array<{ id: string; action: string; created_at: string; details: unknown }>>([]);
  const [today, setToday] = useState<Date | null>(null);

  const loadAll = async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [inc, out, pen, proc, recentDocs, acts] = await Promise.all([
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("type", "incoming"),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("type", "outgoing"),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "processed").gte("updated_at", todayStr),
      supabase.from("documents").select("id,reference_code,title,type,category_sub,created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("activity_log").select("id,action,created_at,details").order("created_at", { ascending: false }).limit(8),
    ]);
    setStats({ incoming: inc.count ?? 0, outgoing: out.count ?? 0, pending: pen.count ?? 0, processedToday: proc.count ?? 0 });
    setRecent(recentDocs.data ?? []);
    setActivity(acts.data ?? []);
    setToday(new Date());
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5 * 60 * 1000);
    let lastDay = new Date().toDateString();
    const dayCheck = setInterval(() => {
      const now = new Date().toDateString();
      if (now !== lastDay) {
        lastDay = now;
        loadAll();
      }
    }, 60 * 1000);
    const onFocus = () => loadAll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      clearInterval(dayCheck);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const todayLabel = today
    ? today.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const todayLabel = today
    ? today.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  });

  const loadDaySummary = async (date: Date) => {
    setSelectedDay(date);
    setLoadingDay(true);
    setDaySummary(null);
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const [inc, out, proc, pen] = await Promise.all([
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("type", "incoming").gte("created_at", startIso).lte("created_at", endIso),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("type", "outgoing").gte("created_at", startIso).lte("created_at", endIso),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "processed").gte("updated_at", startIso).lte("updated_at", endIso),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "pending").gte("created_at", startIso).lte("created_at", endIso),
    ]);
    setDaySummary({ incoming: inc.count ?? 0, outgoing: out.count ?? 0, processed: proc.count ?? 0, pending: pen.count ?? 0 });
    setLoadingDay(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("welcomeBack")}, {fullName} · {role === "director" ? t("roleDirector") : t("roleSecretary")}
          </p>
        </div>
        {todayLabel && (
          <Popover open={popoverOpen} onOpenChange={(o) => { setPopoverOpen(o); if (!o) { setSelectedDay(null); setDaySummary(null); } }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-right transition-colors hover:bg-accent/50"
              >
                <CalendarDays className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{lang === "fr" ? "Aujourd'hui" : "Today"}</p>
                  <p className="text-sm font-semibold capitalize">{todayLabel}</p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {lang === "fr" ? "Résumé des 7 derniers jours" : "Last 7 days summary"}
              </p>
              <div className="space-y-1">
                {last7Days.map((d) => {
                  const isSel = selectedDay && d.toDateString() === selectedDay.toDateString();
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => loadDaySummary(d)}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm capitalize transition-colors ${isSel ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                    >
                      <span>{d.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "short" })}</span>
                      {isToday && <span className="text-[10px] uppercase opacity-70">{lang === "fr" ? "Auj." : "Today"}</span>}
                    </button>
                  );
                })}
              </div>
              {selectedDay && (
                <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold capitalize">
                    {selectedDay.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  {loadingDay || !daySummary ? (
                    <p className="text-xs text-muted-foreground">{lang === "fr" ? "Chargement…" : "Loading…"}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-background p-2">
                        <p className="text-muted-foreground">{t("totalIncoming")}</p>
                        <p className="text-lg font-semibold">{daySummary.incoming}</p>
                      </div>
                      <div className="rounded bg-background p-2">
                        <p className="text-muted-foreground">{t("totalOutgoing")}</p>
                        <p className="text-lg font-semibold">{daySummary.outgoing}</p>
                      </div>
                      <div className="rounded bg-background p-2">
                        <p className="text-muted-foreground">{t("processedToday")}</p>
                        <p className="text-lg font-semibold">{daySummary.processed}</p>
                      </div>
                      <div className="rounded bg-background p-2">
                        <p className="text-muted-foreground">{t("pending")}</p>
                        <p className="text-lg font-semibold">{daySummary.pending}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>


      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Inbox} label={t("totalIncoming")} value={stats?.incoming ?? 0} accent="bg-[var(--cat-sae-bg)] text-[var(--cat-sae)]" to="/incoming" />
        <StatCard icon={Send} label={t("totalOutgoing")} value={stats?.outgoing ?? 0} accent="bg-[var(--cat-eta-bg)] text-[var(--cat-eta)]" to="/outgoing" />
        <StatCard icon={Clock} label={t("pending")} value={stats?.pending ?? 0} accent="bg-[var(--cat-csp-bg)] text-[var(--cat-csp)]" to="/pending" />
        <StatCard icon={CheckCircle2} label={t("processedToday")} value={stats?.processedToday ?? 0} accent="bg-success/15 text-success" to="/processed-today" />
      </div>

      {/* Director printer & folder status */}
      <Link
        to="/scanner"
        className="grid gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-[var(--shadow-card)] sm:grid-cols-2"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Printer className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{t("directorPrinterStatus")}</p>
            <p className="truncate text-sm font-semibold">{PRINTERS.director.name}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${directorLinked ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
              <span className="text-xs">{directorLinked ? t("connected") : t("notConnected")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{t("directorFolderStatus")}</p>
            <p className="truncate text-sm font-semibold">
              {folderStatus.director ?? t("notConnected")}
            </p>
            {!directorLinked && role !== "director" && (
              <p className="mt-1 text-[11px] text-muted-foreground">{t("connectFromDirectorAccount")}</p>
            )}
          </div>
        </div>
      </Link>


      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">{t("quickAccess")}</h2>
          <div className="space-y-2">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">{t("noDocuments")}</p>}
            {recent.map((d) => (
              <Link
                key={d.id}
                to={d.type === "incoming" ? "/incoming" : "/outgoing"}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{d.reference_code}</p>
                </div>
                <CategoryBadge code={d.category_sub} />
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">{t("recentActivity")}</h2>
          <ul className="space-y-2 text-sm">
            {activity.length === 0 && <li className="text-muted-foreground">—</li>}
            {activity.map((a) => (
              <li key={a.id} className="border-b border-border pb-2 last:border-0">
                <p className="font-medium">{a.action}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/legal" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-[var(--shadow-card)]">
          <BookOpen className="h-5 w-5 text-primary" />
          <div><p className="font-medium">{t("legalLibrary")}</p></div>
        </Link>
        <Link to="/reports" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-[var(--shadow-card)]">
          <FileBarChart className="h-5 w-5 text-primary" />
          <div><p className="font-medium">{t("reports")}</p></div>
        </Link>
      </div>

      {lang /* keep ref */ && null}
    </div>
  );
}
