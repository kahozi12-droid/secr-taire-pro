import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, BookOpen, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/legal")({
  component: LegalLibrary,
});

function LegalLibrary() {
  const { t } = useI18n();
  const { role, user } = useAuth();
  const isSecretary = role === "secretary";
  const [items, setItems] = useState<Tables<"legal_texts">[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ reference: "", title: "", category: "", description: "", publication_date: "" });
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const { data } = await supabase.from("legal_texts").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `legal/${Date.now()}-${form.reference}.${ext}`.replace(/\s+/g, "_");
        const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
        if (error) throw error;
        filePath = path; fileName = file.name;
      }
      const { error } = await supabase.from("legal_texts").insert({
        reference: form.reference,
        title: form.title,
        category: form.category,
        description: form.description || null,
        publication_date: form.publication_date || null,
        file_path: filePath, file_name: fileName,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(t("saved"));
      setOpen(false);
      setForm({ reference: "", title: "", category: "", description: "", publication_date: "" });
      setFile(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally { setBusy(false); }
  };

  const open_ = async (path: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const filtered = items?.filter((x) =>
    !search || x.title.toLowerCase().includes(search.toLowerCase()) || x.reference.toLowerCase().includes(search.toLowerCase()) || x.category.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("legalLibrary")}</h1>
          <p className="text-sm text-muted-foreground">{filtered ? `${filtered.length} document${filtered.length !== 1 ? "s" : ""}` : t("loading")}</p>
        </div>
        {isSecretary && (
          <Button onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />{t("addLegalText")}</Button>
        )}
      </div>

      <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered?.length === 0 && <div className="col-span-full rounded-md border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">{t("noDocuments")}</div>}
        {filtered?.map((x) => (
          <div key={x.id} className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="mb-2 flex items-start gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{x.category}</span>
            </div>
            <h3 className="font-medium">{x.title}</h3>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{x.reference}</p>
            {x.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{x.description}</p>}
            {x.file_path && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => open_(x.file_path!)}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />{t("open")}
              </Button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addLegalText")}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>{t("legalRef")}</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required maxLength={100} /></div>
              <div className="space-y-1"><Label>{t("legalCategory")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Loi / Décret / Arrêté…" required maxLength={100} /></div>
              <div className="space-y-1 md:col-span-2"><Label>{t("title")}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} /></div>
              <div className="space-y-1"><Label>{t("publicationDate")}</Label><Input type="date" value={form.publication_date} onChange={(e) => setForm({ ...form, publication_date: e.target.value })} /></div>
              <div className="space-y-1"><Label>PDF</Label><Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            </div>
            <div className="space-y-1"><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={1000} /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>{t("cancel")}</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
