import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Printer, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import drcFlag from "@/assets/drc-flag.jpg";
import saemapeLogo from "@/assets/saemape-logo.jpg";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

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
      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("reports")}</h1>
          <p className="text-sm text-muted-foreground">{t("dailyReport")}</p>
        </div>
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

      {/* Report Document */}
      <div className="report-page mx-auto max-w-[210mm] bg-white p-8 text-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {/* Letterhead */}
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

        {/* Title */}
        <h2 className="mt-6 text-center text-base font-bold underline">{t("reportTitle")}</h2>

        {/* Date */}
        <div className="mt-4 text-right text-sm font-bold underline">{formattedDate}</div>

        {/* Section 1: Incoming */}
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
              return (
                <tr key={doc?.id ?? `e-${i}`}>
                  <td className="border border-black p-1 text-center font-semibold">{i + 1}</td>
                  <td className="border border-black p-1 text-center">{doc?.order_number ?? ""}</td>
                  <td className="border border-black p-1">{doc?.sender ?? ""}</td>
                  <td className="border border-black p-1">{doc ? doc.title + (doc.description ? ` — ${doc.description}` : "") : ""}</td>
                  <td className="border border-black p-1 text-center">{doc ? "" : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Section 2: Outgoing */}
        <h3 className="mt-4 text-sm font-bold underline">2. {t("outgoingMail")}</h3>
        <table className="mt-2 w-full border-collapse border border-black text-[11px]">
          <thead className="bg-gray-200">
            <tr>
              <th className="w-10 border border-black p-1">N°</th>
              <th className="w-24 border border-black p-1">{t("orderNumber")}</th>
              <th className="border border-black p-1">{t("recipient")}</th>
              <th className="border border-black p-1">{t("summary")}</th>
            </tr>
          </thead>
          <tbody>
            {(outgoing.length ? outgoing : Array.from({ length: 5 })).map((d, i) => {
              const doc = d as OutgoingDoc | undefined;
              return (
                <tr key={doc?.id ?? `s-${i}`}>
                  <td className="border border-black p-1 text-center font-semibold">{i + 1}</td>
                  <td className="border border-black p-1 text-center">{doc?.order_number ?? ""}</td>
                  <td className="border border-black p-1">{doc?.recipient ?? ""}</td>
                  <td className="border border-black p-1">{doc ? doc.title + (doc.description ? ` — ${doc.description}` : "") : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Section 3: Other treatments */}
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
