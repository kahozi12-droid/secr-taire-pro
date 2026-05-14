import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Printer, Save, Plus, Trash2, FileText, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import drcFlag from "@/assets/drc-flag.jpg";
import saemapeLogo from "@/assets/saemape-logo.jpg";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

type ReportCategory = "mission" | "technical" | "financial" | "administrative";

const FOLDERS: { key: ReportCategory; labelKey: "folderMission" | "folderTechnical" | "folderFinancial" | "folderAdministrative" }[] = [
  { key: "mission", labelKey: "folderMission" },
  { key: "technical", labelKey: "folderTechnical" },
  { key: "financial", labelKey: "folderFinancial" },
  { key: "administrative", labelKey: "folderAdministrative" },
];

interface ReportDoc {
  id: string;
  category: ReportCategory;
  title: string;
  description: string | null;
  report_date: string;
  file_path: string | null;
  file_name: string | null;
  read_by_director: boolean;
  read_at: string | null;
}

interface IncomingDoc {
  id: string;
  order_number: string | null;
  reference_code: string;
  sender: string | null;
  title: string;
  description: string | null;
  status: "pending" | "processed" | "archived";
  file_path: string | null;
}
interface OutgoingDoc {
  id: string;
  order_number: string | null;
  reference_code: string;
  recipient: string | null;
  title: string;
  description: string | null;
  status: "pending" | "processed" | "archived";
  file_path: string | null;
}
interface OtherTask {
  id: string;
  detail: string;
  observation: string | null;
  position: number;
  saved: boolean;
}

function ReportsPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("reports")}</h1>
      </div>
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="daily">{t("folderDaily")}</TabsTrigger>
          {FOLDERS.map((f) => (
            <TabsTrigger key={f.key} value={f.key}>
              {t(f.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="daily" className="mt-4">
          <DailyReport />
        </TabsContent>
        {FOLDERS.map((f) => (
          <TabsContent key={f.key} value={f.key} className="mt-4">
            <ReportFolder category={f.key} labelKey={f.labelKey} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* -------------------------- Folder of reports -------------------------- */

function ReportFolder({
  category,
  labelKey,
}: {
  category: ReportCategory;
  labelKey: "folderMission" | "folderTechnical" | "folderFinancial" | "folderAdministrative";
}) {
  const { t } = useI18n();
  const { role } = useAuth();
  const isSecretary = role === "secretary";
  const isDirector = role === "director";
  const [items, setItems] = useState<ReportDoc[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("report_documents")
      .select("id,category,title,description,report_date,file_path,file_name,read_by_director,read_at")
      .eq("category", category)
      .order("report_date", { ascending: false });
    if (error) return toast.error(error.message);
    setItems((data ?? []) as ReportDoc[]);
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel(`reports-${category}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_documents", filter: `category=eq.${category}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [category, load]);

  const openFile = async (path: string | null) => {
    if (!path) return toast.error(t("noFile"));
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const toggleRead = async (r: ReportDoc) => {
    const next = !r.read_by_director;
    const { error } = await supabase
      .from("report_documents")
      .update({
        read_by_director: next,
        read_at: next ? new Date().toISOString() : null,
        read_by: next ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
      })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
  };

  const remove = async (r: ReportDoc) => {
    if (!confirm(t("confirmDelete"))) return;
    if (r.file_path) {
      await supabase.storage.from("documents").remove([r.file_path]);
    }
    const { error } = await supabase.from("report_documents").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
  };

  // group by year
  const byYear = (items ?? []).reduce<Record<string, ReportDoc[]>>((acc, r) => {
    const y = (r.report_date ?? "").slice(0, 4) || String(new Date().getFullYear());
    (acc[y] ??= []).push(r);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));
  const currentYear = String(new Date().getFullYear());
  if (years.length === 0) years.push(currentYear);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t(labelKey)}</h2>
        {isSecretary && (
          <Button onClick={() => setOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            {t("newReport")}
          </Button>
        )}
      </div>

      {items === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={[currentYear]} className="w-full">
          {years.map((year) => {
            const list = byYear[year] ?? [];
            return (
              <AccordionItem key={year} value={year}>
                <AccordionTrigger className="text-base font-medium">
                  {t(labelKey)} {year} <span className="ml-2 text-xs text-muted-foreground">({list.length})</span>
                </AccordionTrigger>
                <AccordionContent>
                  {list.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">{t("noReports")}</p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {list.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => openFile(r.file_path)}
                              className="text-left font-medium hover:underline"
                            >
                              {r.title}
                              <ExternalLink className="ml-1 inline h-3 w-3 opacity-60" />
                            </button>
                            <div className="text-xs text-muted-foreground">
                              {r.report_date}
                              {r.description ? ` — ${r.description}` : ""}
                            </div>
                          </div>
                          {r.read_by_director ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("readByDirector")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Circle className="h-3 w-3" />
                              {t("notReadByDirector")}
                            </Badge>
                          )}
                          {isDirector && (
                            <Button size="sm" variant="outline" onClick={() => toggleRead(r)}>
                              {r.read_by_director ? t("markUnread") : t("markRead")}
                            </Button>
                          )}
                          {isSecretary && (
                            <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label="delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <NewReportDialog open={open} onOpenChange={setOpen} category={category} onSaved={() => void load()} />
    </div>
  );
}

function NewReportDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: ReportCategory;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reportDate, setReportDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setReportDate(today);
    setFile(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;
      if (file) {
        const year = reportDate.slice(0, 4);
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `reports/${category}/${year}/${Date.now()}-${title}.${ext}`.replace(/\s+/g, "_");
        const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
        if (error) throw error;
        filePath = path;
        fileName = file.name;
        mimeType = file.type;
      }
      const { error } = await supabase.from("report_documents").insert({
        category,
        title,
        description: description || null,
        report_date: reportDate,
        file_path: filePath,
        file_name: fileName,
        mime_type: mimeType,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(t("saved"));
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addReport")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>{t("title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>{t("reportDate")}</Label>
            <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>{t("description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <Label>{t("file")}</Label>
            <Input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- Daily report (existing) -------------------------- */

function DailyReport() {
  const { t, lang } = useI18n();
  const { role, user } = useAuth();
  const isSecretary = role === "secretary";
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [snapBusy, setSnapBusy] = useState(false);
  const [incoming, setIncoming] = useState<IncomingDoc[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingDoc[]>([]);
  const [tasks, setTasks] = useState<OtherTask[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [{ data: inc }, { data: out }, { data: tk }] = await Promise.all([
        supabase
          .from("documents")
          .select("id,order_number,reference_code,sender,title,description,status,file_path")
          .eq("type", "incoming")
          .eq("document_date", date)
          .order("created_at"),
        supabase
          .from("documents")
          .select("id,order_number,reference_code,recipient,title,description,status,file_path")
          .eq("type", "outgoing")
          .eq("document_date", date)
          .order("created_at"),
        supabase
          .from("other_tasks")
          .select("id,detail,observation,position")
          .eq("task_date", date)
          .order("position")
          .order("created_at"),
      ]);
      setIncoming((inc ?? []) as IncomingDoc[]);
      setOutgoing((out ?? []) as OutgoingDoc[]);
      setTasks(((tk ?? []) as Omit<OtherTask, "saved">[]).map((r) => ({ ...r, saved: true })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }, [date, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`report-${date}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `document_date=eq.${date}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [date, load]);

  const openDoc = async (filePath: string | null) => {
    if (!filePath) return toast.error(t("noFile"));
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 60 * 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const formattedDate = (() => {
    try {
      return new Date(date + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return date;
    }
  })();

  const addTaskRow = () => {
    setTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), detail: "", observation: "", position: prev.length, saved: false },
    ]);
  };

  const updateTask = (id: string, patch: Partial<OtherTask>) => {
    setTasks((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveTask = async (row: OtherTask) => {
    if (!user || !row.detail.trim()) return;
    if (row.saved) {
      const { error } = await supabase
        .from("other_tasks")
        .update({ detail: row.detail, observation: row.observation || null, position: row.position })
        .eq("id", row.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase
        .from("other_tasks")
        .insert({
          task_date: date,
          detail: row.detail,
          observation: row.observation || null,
          position: row.position,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      updateTask(row.id, { id: data!.id, saved: true });
    }
  };

  const deleteTask = async (row: OtherTask) => {
    if (row.saved) {
      const { error } = await supabase.from("other_tasks").delete().eq("id", row.id);
      if (error) return toast.error(error.message);
    }
    setTasks((prev) => prev.filter((r) => r.id !== row.id));
  };

  const archiveSnapshot = async () => {
    setSnapBusy(true);
    try {
      const { error } = await supabase.rpc("snapshot_daily_report", { _date: date });
      if (error) throw error;
      toast.success(t("snapshotSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSnapBusy(false);
    }
  };

  const print = () => window.print();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">{t("dailyReport")}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("selectDate")}</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[170px]" />
          </div>
          {isSecretary && (
            <Button variant="outline" onClick={archiveSnapshot} disabled={snapBusy}>
              {snapBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t("saveSnapshot")}
            </Button>
          )}
          <Button onClick={print}>
            <Printer className="mr-2 h-4 w-4" />
            {t("print")}
          </Button>
        </div>
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground print:hidden">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      )}

      <div className="report-page mx-auto max-w-[210mm] bg-white p-8 text-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <table className="w-full border-collapse border border-black text-[11px]">
          <tbody>
            <tr>
              <td colSpan={3} className="border border-black p-2 text-center">
                <div className="font-bold">{t("countryHeader")}</div>
                <img src={drcFlag} alt="DRC flag" className="mx-auto my-1 h-6" />
                <div className="text-base font-bold">{t("ministryHeader")}</div>
              </td>
            </tr>
            <tr>
              <td className="w-1/3 border border-black p-2 text-center italic">
                <div>{t("phoneHeader")}</div>
                <div className="text-blue-700 underline">{t("emailHeader")}</div>
              </td>
              <td className="w-1/3 border border-black p-2 text-center">
                <div className="italic">{t("serviceHeader")}</div>
                <img src={saemapeLogo} alt="SAEMAPE" className="mx-auto mt-1 h-8" />
              </td>
              <td className="w-1/3 border border-black p-2 text-center">
                <div className="font-bold">{t("directionHeader")}</div>
                <div className="italic">{t("addressHeader")}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className="mt-6 text-center text-base font-bold underline">{t("reportTitle")}</h2>
        <div className="mt-4 text-right text-sm font-bold underline">{formattedDate}</div>

        <h3 className="mt-4 text-sm font-bold underline">1. {t("incomingMail")}</h3>
        <table className="mt-2 w-full border-collapse border border-black text-[11px]">
          <thead className="bg-gray-200">
            <tr>
              <th className="w-10 border border-black p-1">N°</th>
              <th className="w-24 border border-black p-1">{t("orderNumber")}</th>
              <th className="border border-black p-1">{t("sender")}</th>
              <th className="border border-black p-1">{t("summary")}</th>
              <th className="w-28 border border-black p-1">{t("observation")}</th>
            </tr>
          </thead>
          <tbody>
            {(incoming.length ? incoming : Array.from({ length: 5 })).map((d, i) => {
              const doc = d as IncomingDoc | undefined;
              const treated = doc && (doc.status === "processed" || doc.status === "archived");
              return (
                <tr key={doc?.id ?? `e-${i}`}>
                  <td className="border border-black p-1 text-center font-semibold">{i + 1}</td>
                  <td className="border border-black p-1 text-center">{doc?.order_number ?? ""}</td>
                  <td className="border border-black p-1">{doc?.sender ?? ""}</td>
                  <td className="border border-black p-1">
                    {doc ? (
                      doc.file_path ? (
                        <button
                          type="button"
                          onClick={() => openDoc(doc.file_path)}
                          className="text-left text-blue-700 underline hover:opacity-80 print:text-black print:no-underline"
                        >
                          {doc.title}{doc.description ? ` — ${doc.description}` : ""}
                        </button>
                      ) : (
                        <span>{doc.title}{doc.description ? ` — ${doc.description}` : ""}</span>
                      )
                    ) : ""}
                  </td>
                  <td className="border border-black p-1 text-center">
                    {doc ? (
                      <span className={treated ? "font-semibold text-green-700" : "text-gray-600"}>
                        {treated ? "✓ " + t("treated") : t("notTreated")}
                      </span>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 className="mt-4 text-sm font-bold underline">2. {t("outgoingMail")}</h3>
        <table className="mt-2 w-full border-collapse border border-black text-[11px]">
          <thead className="bg-gray-200">
            <tr>
              <th className="w-10 border border-black p-1">N°</th>
              <th className="w-24 border border-black p-1">{t("orderNumber")}</th>
              <th className="border border-black p-1">{t("recipient")}</th>
              <th className="border border-black p-1">{t("summary")}</th>
              <th className="w-28 border border-black p-1">{t("observation")}</th>
            </tr>
          </thead>
          <tbody>
            {(outgoing.length ? outgoing : Array.from({ length: 5 })).map((d, i) => {
              const doc = d as OutgoingDoc | undefined;
              const treated = doc && (doc.status === "processed" || doc.status === "archived");
              return (
                <tr key={doc?.id ?? `s-${i}`}>
                  <td className="border border-black p-1 text-center font-semibold">{i + 1}</td>
                  <td className="border border-black p-1 text-center">{doc?.order_number ?? ""}</td>
                  <td className="border border-black p-1">{doc?.recipient ?? ""}</td>
                  <td className="border border-black p-1">
                    {doc ? (
                      doc.file_path ? (
                        <button
                          type="button"
                          onClick={() => openDoc(doc.file_path)}
                          className="text-left text-blue-700 underline hover:opacity-80 print:text-black print:no-underline"
                        >
                          {doc.title}{doc.description ? ` — ${doc.description}` : ""}
                        </button>
                      ) : (
                        <span>{doc.title}{doc.description ? ` — ${doc.description}` : ""}</span>
                      )
                    ) : ""}
                  </td>
                  <td className="border border-black p-1 text-center">
                    {doc ? (
                      <span className={treated ? "font-semibold text-green-700" : "text-gray-600"}>
                        {treated ? "✓ " + t("treated") : t("notTreated")}
                      </span>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 flex items-center justify-between">
          <h3 className="text-sm font-bold underline">3. {t("otherTreatments")}</h3>
          {isSecretary && (
            <Button size="sm" variant="outline" onClick={addTaskRow} className="print:hidden">
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("addRow")}
            </Button>
          )}
        </div>
        <table className="mt-2 w-full border-collapse border border-black text-[11px]">
          <thead className="bg-gray-200">
            <tr>
              <th className="w-10 border border-black p-1">N°</th>
              <th className="border border-black p-1">{t("detail")}</th>
              <th className="w-40 border border-black p-1">{t("observation")}</th>
              {isSecretary && <th className="w-16 border border-black p-1 print:hidden">·</th>}
            </tr>
          </thead>
          <tbody>
            {(tasks.length ? tasks : Array.from({ length: 5 })).map((r, i) => {
              const row = r as OtherTask | undefined;
              if (!row) {
                return (
                  <tr key={`t-${i}`}>
                    <td className="border border-black p-1 text-center font-semibold">{i + 1}</td>
                    <td className="border border-black p-1">&nbsp;</td>
                    <td className="border border-black p-1">&nbsp;</td>
                    {isSecretary && <td className="border border-black p-1 print:hidden">&nbsp;</td>}
                  </tr>
                );
              }
              return (
                <tr key={row.id}>
                  <td className="border border-black p-1 text-center font-semibold">{i + 1}</td>
                  <td className="border border-black p-0">
                    {isSecretary ? (
                      <input
                        className="w-full bg-transparent px-1 py-1 outline-none print:p-1"
                        value={row.detail}
                        onChange={(e) => updateTask(row.id, { detail: e.target.value, saved: false })}
                        onBlur={() => saveTask({ ...row, saved: row.saved && row.detail !== "" })}
                      />
                    ) : (
                      <span className="block px-1 py-1">{row.detail}</span>
                    )}
                  </td>
                  <td className="border border-black p-0">
                    {isSecretary ? (
                      <input
                        className="w-full bg-transparent px-1 py-1 outline-none print:p-1"
                        value={row.observation ?? ""}
                        onChange={(e) => updateTask(row.id, { observation: e.target.value, saved: false })}
                        onBlur={() => saveTask(row)}
                      />
                    ) : (
                      <span className="block px-1 py-1">{row.observation ?? ""}</span>
                    )}
                  </td>
                  {isSecretary && (
                    <td className="border border-black p-1 text-center print:hidden">
                      <button
                        type="button"
                        onClick={() => deleteTask(row)}
                        className="text-destructive hover:opacity-70"
                        aria-label="delete"
                      >
                        <Trash2 className="mx-auto h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body * { visibility: hidden; }
          .report-page, .report-page * { visibility: visible; }
          .report-page { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
