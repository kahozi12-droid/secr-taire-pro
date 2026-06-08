import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, BookOpen, FileText, Loader2, Star, StarOff, Link2, ExternalLink,
  Trash2, Download, NotebookPen, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LEGAL_TEXT_TYPES, LEGAL_RELATIONS, relationLabel } from "@/lib/legalTypes";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/legal")({
  component: LegalLibrary,
});

type LegalText = Tables<"legal_texts">;
type LegalRef = Tables<"legal_text_references">;
type LegalAnno = Tables<"legal_annotations">;

function LegalLibrary() {
  const { t } = useI18n();
  const { role, user } = useAuth();
  const canEdit = role === "secretary";

  const [items, setItems] = useState<LegalText[] | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterFav, setFilterFav] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<LegalText | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("legal_texts")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as LegalText[]);
    if (user) {
      const { data: favs } = await supabase
        .from("legal_favorites")
        .select("legal_text_id")
        .eq("user_id", user.id);
      setFavorites(new Set((favs ?? []).map((f) => f.legal_text_id)));
    }
  };
  useEffect(() => { load(); }, [user?.id]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = search.trim().toLowerCase();
    return items.filter((x) => {
      if (filterType !== "all" && (x.text_type ?? "") !== filterType) return false;
      if (filterFav && !favorites.has(x.id)) return false;
      if (fromDate && (x.publication_date ?? "") < fromDate) return false;
      if (toDate && (x.publication_date ?? "") > toDate) return false;
      if (q) {
        const hay = `${x.title} ${x.reference} ${x.category} ${x.description ?? ""} ${x.text_type ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filterType, filterFav, favorites, fromDate, toDate]);

  const toggleFav = async (textId: string) => {
    if (!user) return;
    const isFav = favorites.has(textId);
    if (isFav) {
      await supabase.from("legal_favorites").delete().eq("user_id", user.id).eq("legal_text_id", textId);
      setFavorites((p) => { const n = new Set(p); n.delete(textId); return n; });
    } else {
      await supabase.from("legal_favorites").insert({ user_id: user.id, legal_text_id: textId });
      setFavorites((p) => new Set(p).add(textId));
    }
  };

  const exportCsv = () => {
    if (!filtered) return;
    const headers = ["Référence", "Type", "Titre", "Catégorie", "Date de publication", "URL source", "Description"];
    const rows = filtered.map((x) => [
      x.reference, x.text_type ?? "", x.title, x.category,
      x.publication_date ?? "", x.source_url ?? "", (x.description ?? "").replace(/\s+/g, " "),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bibliotheque-juridique-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("legalLibrary")}</h1>
          <p className="text-sm text-muted-foreground">
            {filtered ? `${filtered.length} document${filtered.length !== 1 ? "s" : ""}` : t("loading")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered?.length}>
            <Download className="mr-1.5 h-4 w-4" />Exporter CSV
          </Button>
          {canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />{t("addLegalText")}
            </Button>
          )}
        </div>
      </div>

      {/* Advanced search */}
      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-5">
        <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="md:col-span-2" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger><SelectValue placeholder="Type de texte" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {LEGAL_TEXT_TYPES.map((tt) => <SelectItem key={tt} value={tt}>{tt}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="Du" />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="Au" />
        <div className="md:col-span-5 flex items-center gap-2">
          <Button size="sm" variant={filterFav ? "default" : "outline"} onClick={() => setFilterFav((v) => !v)}>
            <Star className="mr-1.5 h-3.5 w-3.5" />Favoris uniquement
          </Button>
          {(search || filterType !== "all" || fromDate || toDate || filterFav) && (
            <Button size="sm" variant="ghost" onClick={() => {
              setSearch(""); setFilterType("all"); setFromDate(""); setToDate(""); setFilterFav(false);
            }}>
              <X className="mr-1 h-3.5 w-3.5" />Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered?.length === 0 && (
          <div className="col-span-full rounded-md border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
            {t("noDocuments")}
          </div>
        )}
        {filtered?.map((x) => (
          <div key={x.id} className="group flex flex-col rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-accent/30">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-primary" />
                {x.text_type && <Badge variant="default" className="text-[10px]">{x.text_type}</Badge>}
                <Badge variant="secondary" className="text-[10px]">{x.category}</Badge>
              </div>
              <button onClick={() => toggleFav(x.id)} aria-label="Favori" className="text-muted-foreground hover:text-foreground">
                {favorites.has(x.id) ? <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" /> : <StarOff className="h-4 w-4" />}
              </button>
            </div>
            <button onClick={() => setDetail(x)} className="text-left">
              <h3 className="font-medium leading-snug">{x.title}</h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{x.reference}</p>
              {x.publication_date && <p className="mt-0.5 text-xs text-muted-foreground">Publié le {x.publication_date}</p>}
              {x.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{x.description}</p>}
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              {x.file_path && (
                <Button size="sm" variant="outline" onClick={() => openFile(x.file_path!)}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" />{t("open")}
                </Button>
              )}
              {x.source_url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={x.source_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Source</a>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setDetail(x)}>
                <NotebookPen className="mr-1.5 h-3.5 w-3.5" />Détails
              </Button>
            </div>
          </div>
        ))}
      </div>

      {createOpen && (
        <CreateEditDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={() => { setCreateOpen(false); load(); }}
          userId={user?.id}
        />
      )}

      {detail && (
        <DetailDialog
          text={detail}
          allTexts={items ?? []}
          canEdit={canEdit}
          userId={user?.id}
          isFavorite={favorites.has(detail.id)}
          onToggleFavorite={() => toggleFav(detail.id)}
          onClose={() => setDetail(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

/* ------------------ Create / Edit dialog ------------------ */
function CreateEditDialog({
  open, onOpenChange, onSaved, userId, existing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  userId?: string;
  existing?: LegalText;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    reference: existing?.reference ?? "",
    title: existing?.title ?? "",
    text_type: existing?.text_type ?? "",
    category: existing?.category ?? "",
    description: existing?.description ?? "",
    publication_date: existing?.publication_date ?? "",
    source_url: existing?.source_url ?? "",
  });
  const [file, setFile] = useState<File | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    try {
      let filePath = existing?.file_path ?? null;
      let fileName = existing?.file_name ?? null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `legal/${Date.now()}-${form.reference}.${ext}`.replace(/\s+/g, "_");
        const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
        if (error) throw error;
        filePath = path; fileName = file.name;
      }
      const payload = {
        reference: form.reference,
        title: form.title,
        text_type: form.text_type || null,
        category: form.category,
        description: form.description || null,
        publication_date: form.publication_date || null,
        source_url: form.source_url || null,
        file_path: filePath,
        file_name: fileName,
      };
      if (existing) {
        const { error } = await supabase.from("legal_texts").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("legal_texts").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
      toast.success(t("saved"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{existing ? "Modifier le texte" : t("addLegalText")}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("legalRef")}</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label>Type de texte</Label>
              <Select value={form.text_type} onValueChange={(v) => setForm({ ...form, text_type: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger>
                <SelectContent>
                  {LEGAL_TEXT_TYPES.map((tt) => <SelectItem key={tt} value={tt}>{tt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>{t("title")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label>{t("legalCategory")}</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Domaine juridique" required maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label>{t("publicationDate")}</Label>
              <Input type="date" value={form.publication_date} onChange={(e) => setForm({ ...form, publication_date: e.target.value })} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>URL source (Journal Officiel, Primature, etc.)</Label>
              <Input type="url" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Fichier PDF {existing?.file_name ? `(actuel : ${existing.file_name})` : ""}</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("description")}</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={2000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>{t("cancel")}</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------ Detail dialog (refs + annotations) ------------------ */
function DetailDialog({
  text, allTexts, canEdit, userId, isFavorite, onToggleFavorite, onClose, onChanged,
}: {
  text: LegalText;
  allTexts: LegalText[];
  canEdit: boolean;
  userId?: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [refs, setRefs] = useState<(LegalRef & { target?: LegalText })[]>([]);
  const [annos, setAnnos] = useState<LegalAnno[]>([]);
  const [newAnno, setNewAnno] = useState("");
  const [newRefTarget, setNewRefTarget] = useState<string>("");
  const [newRefRelation, setNewRefRelation] = useState<string>("related");
  const [editOpen, setEditOpen] = useState(false);

  const loadAll = async () => {
    const { data: r } = await supabase
      .from("legal_text_references").select("*").eq("source_id", text.id);
    const targetMap = new Map(allTexts.map((x) => [x.id, x]));
    setRefs(((r ?? []) as LegalRef[]).map((x) => ({ ...x, target: targetMap.get(x.target_id) })));
    if (userId) {
      const { data: a } = await supabase
        .from("legal_annotations").select("*")
        .eq("legal_text_id", text.id).eq("user_id", userId)
        .order("created_at", { ascending: false });
      setAnnos((a ?? []) as LegalAnno[]);
    }
  };
  useEffect(() => { loadAll(); }, [text.id, userId]);

  const addRef = async () => {
    if (!userId || !newRefTarget) return;
    const { error } = await supabase.from("legal_text_references").insert({
      source_id: text.id, target_id: newRefTarget, relation: newRefRelation, created_by: userId,
    });
    if (error) return toast.error(error.message);
    setNewRefTarget(""); loadAll();
  };
  const delRef = async (id: string) => {
    const { error } = await supabase.from("legal_text_references").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadAll();
  };

  const addAnno = async () => {
    if (!userId || !newAnno.trim()) return;
    const { error } = await supabase.from("legal_annotations").insert({
      user_id: userId, legal_text_id: text.id, content: newAnno.trim(),
    });
    if (error) return toast.error(error.message);
    setNewAnno(""); loadAll();
  };
  const delAnno = async (id: string) => {
    const { error } = await supabase.from("legal_annotations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadAll();
  };

  const deleteText = async () => {
    if (!confirm("Supprimer définitivement ce texte ?")) return;
    const { error } = await supabase.from("legal_texts").delete().eq("id", text.id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé");
    onClose(); onChanged();
  };

  const exportSingle = () => {
    const lines = [
      `Référence: ${text.reference}`,
      `Type: ${text.text_type ?? ""}`,
      `Titre: ${text.title}`,
      `Catégorie: ${text.category}`,
      `Date: ${text.publication_date ?? ""}`,
      `Source: ${text.source_url ?? ""}`,
      ``,
      `Description:`, text.description ?? "",
      ``,
      `Liens croisés:`,
      ...refs.map((r) => `- [${relationLabel(r.relation)}] ${r.target?.reference ?? r.target_id} — ${r.target?.title ?? ""}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${text.reference}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const shareLink = async () => {
    const link = `${window.location.origin}/legal#${text.id}`;
    await navigator.clipboard.writeText(link);
    toast.success("Lien copié");
  };

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {text.text_type && <Badge>{text.text_type}</Badge>}
              <span>{text.title}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{text.reference}</span>
            <span>·</span>
            <span>{text.category}</span>
            {text.publication_date && <><span>·</span><span>{text.publication_date}</span></>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onToggleFavorite}>
              {isFavorite ? <Star className="mr-1.5 h-3.5 w-3.5 fill-yellow-500 text-yellow-500" /> : <StarOff className="mr-1.5 h-3.5 w-3.5" />}
              {isFavorite ? "Retirer favori" : "Ajouter aux favoris"}
            </Button>
            {text.file_path && (
              <Button size="sm" variant="outline" onClick={async () => {
                const { data } = await supabase.storage.from("documents").createSignedUrl(text.file_path!, 3600);
                if (data) window.open(data.signedUrl, "_blank");
              }}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />Ouvrir le PDF
              </Button>
            )}
            {text.source_url && (
              <Button size="sm" variant="outline" asChild>
                <a href={text.source_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Page web source
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={exportSingle}>
              <Download className="mr-1.5 h-3.5 w-3.5" />Exporter
            </Button>
            <Button size="sm" variant="outline" onClick={shareLink}>
              <Link2 className="mr-1.5 h-3.5 w-3.5" />Partager le lien
            </Button>
            {canEdit && (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Modifier</Button>
                <Button size="sm" variant="destructive" onClick={deleteText}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Supprimer
                </Button>
              </>
            )}
          </div>

          {text.description && (
            <p className="rounded-md border border-border bg-muted/30 p-3 text-sm">{text.description}</p>
          )}

          <Tabs defaultValue="refs">
            <TabsList>
              <TabsTrigger value="refs">Liens croisés ({refs.length})</TabsTrigger>
              <TabsTrigger value="annos">Mes annotations ({annos.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="refs" className="space-y-3">
              {refs.length === 0 && <p className="text-sm text-muted-foreground">Aucun lien.</p>}
              <ul className="space-y-1.5">
                {refs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
                    <div className="min-w-0">
                      <Badge variant="outline" className="mr-2 text-[10px]">{relationLabel(r.relation)}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">{r.target?.reference}</span>{" "}
                      <span>{r.target?.title ?? "—"}</span>
                    </div>
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => delRef(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && (
                <div className="grid gap-2 rounded-md border border-dashed border-border p-2 md:grid-cols-[1fr,160px,auto]">
                  <Select value={newRefTarget} onValueChange={setNewRefTarget}>
                    <SelectTrigger><SelectValue placeholder="Texte à lier" /></SelectTrigger>
                    <SelectContent>
                      {allTexts.filter((x) => x.id !== text.id).map((x) => (
                        <SelectItem key={x.id} value={x.id}>{x.reference} — {x.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newRefRelation} onValueChange={setNewRefRelation}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEGAL_RELATIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={addRef} disabled={!newRefTarget}>
                    <Plus className="mr-1 h-4 w-4" />Lier
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="annos" className="space-y-3">
              {annos.length === 0 && <p className="text-sm text-muted-foreground">Aucune annotation personnelle.</p>}
              <ul className="space-y-2">
                {annos.map((a) => (
                  <li key={a.id} className="rounded-md border border-border p-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="whitespace-pre-wrap">{a.content}</p>
                      <Button size="icon" variant="ghost" onClick={() => delAnno(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
              <div className="space-y-2 rounded-md border border-dashed border-border p-2">
                <Textarea
                  value={newAnno}
                  onChange={(e) => setNewAnno(e.target.value)}
                  placeholder="Ajouter une note personnelle (privée)…"
                  rows={3} maxLength={2000}
                />
                <Button size="sm" onClick={addAnno} disabled={!newAnno.trim()}>
                  <Plus className="mr-1 h-4 w-4" />Ajouter
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {editOpen && (
        <CreateEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={() => { setEditOpen(false); onChanged(); }}
          userId={userId}
          existing={text}
        />
      )}
    </>
  );
}
