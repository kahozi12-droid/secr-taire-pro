import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Inbox, Send, Clock, CheckCircle2, BookOpen, FileBarChart, Printer, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/providers/AuthProvider";
import { CategoryBadge } from "@/components/CategoryPicker";
import { PRINTERS } from "@/lib/printers";
import { usePrinterFolderStatus } from "@/lib/printerStatus";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

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

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [inc, out, pen, proc, recentDocs, acts] = await Promise.all([
        supabase.from("documents").select("*", { count: "exact", head: true }).eq("type", "incoming"),
        supabase.from("documents").select("*", { count: "exact", head: true }).eq("type", "outgoing"),
        supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "processed").gte("updated_at", today),
        supabase.from("documents").select("id,reference_code,title,type,category_sub,created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("activity_log").select("id,action,created_at,details").order("created_at", { ascending: false }).limit(8),
      ]);
      setStats({ incoming: inc.count ?? 0, outgoing: out.count ?? 0, pending: pen.count ?? 0, processedToday: proc.count ?? 0 });
      setRecent(recentDocs.data ?? []);
      setActivity(acts.data ?? []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("welcomeBack")}, {fullName} · {role === "director" ? t("roleDirector") : t("roleSecretary")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Inbox} label={t("totalIncoming")} value={stats?.incoming ?? 0} accent="bg-[var(--cat-sae-bg)] text-[var(--cat-sae)]" />
        <StatCard icon={Send} label={t("totalOutgoing")} value={stats?.outgoing ?? 0} accent="bg-[var(--cat-eta-bg)] text-[var(--cat-eta)]" />
        <StatCard icon={Clock} label={t("pending")} value={stats?.pending ?? 0} accent="bg-[var(--cat-csp-bg)] text-[var(--cat-csp)]" />
        <StatCard icon={CheckCircle2} label={t("processedToday")} value={stats?.processedToday ?? 0} accent="bg-success/15 text-success" />
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
