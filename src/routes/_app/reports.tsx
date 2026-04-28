import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, FileBarChart, Printer } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/classification";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

interface Doc { reference_code: string; title: string; type: string; category_main: string; category_sub: string; status: string; document_date: string; sender: string | null; recipient: string | null }

function ReportsPage() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ from: string; to: string; docs: Doc[] } | null>(null);

  const generate = async (range: "today" | "month") => {
    setBusy(true);
    try {
      const now = new Date();
      const from = range === "today" ? format(now, "yyyy-MM-dd") : format(startOfMonth(now), "yyyy-MM-dd");
      const to = range === "today" ? format(now, "yyyy-MM-dd") : format(endOfMonth(now), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("documents")
        .select("reference_code,title,type,category_main,category_sub,status,document_date,sender,recipient")
        .gte("document_date", from).lte("document_date", to)
        .order("document_date", { ascending: false });
      if (error) throw error;
      setReport({ from, to, docs: (data ?? []) as Doc[] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally { setBusy(false); }
  };

  const print = () => window.print();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("reports")}</h1>
          <p className="text-sm text-muted-foreground">{t("dailyReport")} · {t("monthlyReport")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generate("today")} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileBarChart className="mr-2 h-4 w-4" />}
            {t("today")}
          </Button>
          <Button onClick={() => generate("month")} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileBarChart className="mr-2 h-4 w-4" />}
            {t("thisMonth")}
          </Button>
        </div>
      </div>

      {!report && (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground print:hidden">
          {t("generateReport")}
        </div>
      )}

      {report && (
        <div className="rounded-xl border border-border bg-card p-6 print:border-0 print:shadow-none">
          <div className="mb-4 flex items-center justify-between print:block">
            <div>
              <h2 className="text-xl font-semibold">{t("appName")}</h2>
              <p className="text-sm text-muted-foreground">{t("period")}: {report.from} → {report.to}</p>
            </div>
            <Button size="sm" variant="outline" onClick={print} className="print:hidden">
              <Printer className="mr-2 h-4 w-4" />{t("exportPdf")}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {CATEGORIES.map((c) => {
              const n = report.docs.filter((d) => d.category_main === c.code).length;
              return (
                <div key={c.code} className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs uppercase text-muted-foreground">{c.code}</p>
                  <p className="text-2xl font-semibold">{n}</p>
                </div>
              );
            })}
          </div>

          <h3 className="mt-6 mb-2 text-sm font-semibold">{t("totalIncoming")}: {report.docs.filter((d) => d.type === "incoming").length} · {t("totalOutgoing")}: {report.docs.filter((d) => d.type === "outgoing").length}</h3>

          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">{t("date")}</th>
                <th className="px-2 py-1.5 text-left">{t("code")}</th>
                <th className="px-2 py-1.5 text-left">{t("type")}</th>
                <th className="px-2 py-1.5 text-left">{t("title")}</th>
                <th className="px-2 py-1.5 text-left">{t("category")}</th>
                <th className="px-2 py-1.5 text-left">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {report.docs.map((d) => (
                <tr key={d.reference_code} className="border-t border-border">
                  <td className="px-2 py-1.5">{d.document_date}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{d.reference_code}</td>
                  <td className="px-2 py-1.5">{d.type}</td>
                  <td className="px-2 py-1.5">{d.title}</td>
                  <td className="px-2 py-1.5">{d.category_sub}</td>
                  <td className="px-2 py-1.5">{d.status}</td>
                </tr>
              ))}
              {report.docs.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">{t("noDocuments")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
