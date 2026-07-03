import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  cloudList,
  cloudUpload,
  cloudSignedUrl,
  cloudDownload,
  cloudMove,
  cloudRename,
  cloudSoftDelete,
  cloudMkdir,
  formatBytes,
} from "@/lib/scannerArchive";
import { logCloudActivity } from "@/lib/cloudActivity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronRight, Folder, FileText, Upload, Download, Trash2, Edit3, Move, Plus, Eye, FolderPlus, Archive } from "lucide-react";

export function CloudExplorer({ uid, year }: { uid: string; year: number }) {
  const [path, setPath] = useState<string>(String(year));
  const [folders, setFolders] = useState<{ name: string; path: string }[]>([]);
  const [files, setFiles] = useState<{ name: string; path: string; size: number; updated_at?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [renameFor, setRenameFor] = useState<{ path: string; name: string } | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [moveFor, setMoveFor] = useState<{ path: string; name: string } | null>(null);
  const [moveVal, setMoveVal] = useState("");
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirVal, setMkdirVal] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await cloudList(uid, path);
      setFolders(r.folders);
      setFiles(r.files);
    } catch (e) {
      toast.error("Erreur de chargement", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [uid, path]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPath(String(year)); }, [year]);

  const crumbs = path.split("/").filter(Boolean);

  const handleUpload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const arr = Array.from(list);
    toast.info(`Téléversement de ${arr.length} fichier(s)...`);
    let ok = 0;
    for (const f of arr) {
      try {
        const rel = `${path}/${f.name}`;
        await cloudUpload(uid, rel, f);
        await logCloudActivity("upload", rel, null, f.size);
        ok++;
      } catch (e) {
        toast.error(`Échec: ${f.name}`, { description: (e as Error).message });
      }
    }
    toast.success(`${ok}/${arr.length} téléversé(s)`);
    await load();
  };

  const handlePreview = async (rel: string, name: string) => {
    try {
      const url = await cloudSignedUrl(uid, rel, 300);
      setPreview({ url, name });
    } catch (e) {
      toast.error("Aperçu impossible", { description: (e as Error).message });
    }
  };

  const handleDownload = async (rel: string, name: string) => {
    try {
      const blob = await cloudDownload(uid, rel);
      await logCloudActivity("download", rel, null, blob.size);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    }
  };

  const handleSoftDelete = async (rel: string, size: number) => {
    if (!confirm("Envoyer ce fichier à la corbeille ?")) return;
    try {
      const trashed = await cloudSoftDelete(uid, rel);
      await supabase.from("cloud_trash").insert({
        original_path: rel,
        trashed_path: trashed,
        size,
        trashed_by: uid,
      });
      await logCloudActivity("delete", rel, trashed, size);
      toast.success("Envoyé à la corbeille");
      await load();
    } catch (e) {
      toast.error("Suppression impossible", { description: (e as Error).message });
    }
  };

  const handleRename = async () => {
    if (!renameFor || !renameVal.trim()) return;
    try {
      const newPath = await cloudRename(uid, renameFor.path, renameVal.trim());
      await logCloudActivity("rename", renameFor.path, newPath);
      toast.success("Renommé");
      setRenameFor(null);
      await load();
    } catch (e) {
      toast.error("Renommage impossible", { description: (e as Error).message });
    }
  };

  const handleMove = async () => {
    if (!moveFor || !moveVal.trim()) return;
    try {
      const to = `${moveVal.trim().replace(/^\/|\/$/g, "")}/${moveFor.name}`;
      await cloudMove(uid, moveFor.path, to);
      await logCloudActivity("move", moveFor.path, to);
      toast.success("Déplacé");
      setMoveFor(null);
      await load();
    } catch (e) {
      toast.error("Déplacement impossible", { description: (e as Error).message });
    }
  };

  const handleMkdir = async () => {
    if (!mkdirVal.trim()) return;
    try {
      const rel = `${path}/${mkdirVal.trim()}`;
      await cloudMkdir(uid, rel);
      await logCloudActivity("mkdir", rel);
      toast.success("Dossier créé");
      setMkdirOpen(false); setMkdirVal("");
      await load();
    } catch (e) {
      toast.error("Création impossible", { description: (e as Error).message });
    }
  };

  const totalSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        {crumbs.map((c, i) => {
          const p = crumbs.slice(0, i + 1).join("/");
          const isLast = i === crumbs.length - 1;
          return (
            <span key={p} className="flex items-center gap-1">
              <button
                className={isLast ? "font-semibold" : "text-primary hover:underline"}
                onClick={() => setPath(p)}
              >{c}</button>
              {!isLast && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </span>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <label>
          <input type="file" multiple className="hidden" onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }} />
          <Button asChild size="sm" variant="default"><span className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Téléverser</span></Button>
        </label>
        <Button size="sm" variant="outline" onClick={() => setMkdirOpen(true)}><FolderPlus className="mr-2 h-4 w-4" />Nouveau dossier</Button>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>{folders.length} dossier(s)</span>
          <span>{files.length} fichier(s) — {formatBytes(totalSize)}</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="rounded-md border">
          {folders.length === 0 && files.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Dossier vide.</p>
          )}
          {folders.map((f) => (
            <button
              key={f.path}
              onClick={() => setPath(f.path)}
              className="flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm hover:bg-accent/50 last:border-b-0"
            >
              <Folder className="h-4 w-4 text-primary" />
              <span className="flex-1">{f.name}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
          {files.map((f) => (
            <div key={f.path} className="flex items-center gap-2 border-b px-3 py-2 text-sm hover:bg-accent/30 last:border-b-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
              <Button size="icon" variant="ghost" title="Aperçu" onClick={() => handlePreview(f.path, f.name)}><Eye className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" title="Télécharger" onClick={() => handleDownload(f.path, f.name)}><Download className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" title="Renommer" onClick={() => { setRenameFor({ path: f.path, name: f.name }); setRenameVal(f.name); }}><Edit3 className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" title="Déplacer" onClick={() => { setMoveFor({ path: f.path, name: f.name }); setMoveVal(path); }}><Move className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" title="Supprimer" onClick={() => handleSoftDelete(f.path, f.size)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle className="truncate">{preview?.name}</DialogTitle></DialogHeader>
          {preview && (
            <iframe src={preview.url} className="h-[70vh] w-full rounded border" title={preview.name} />
          )}
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renameFor} onOpenChange={(o) => !o && setRenameFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renommer</DialogTitle></DialogHeader>
          <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameFor(null)}>Annuler</Button>
            <Button onClick={handleRename}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move */}
      <Dialog open={!!moveFor} onOpenChange={(o) => !o && setMoveFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Déplacer vers…</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Chemin relatif (ex : {year}/01-Janvier/Courriers Entrants/SAE_DG)</p>
          <Input value={moveVal} onChange={(e) => setMoveVal(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveFor(null)}>Annuler</Button>
            <Button onClick={handleMove}>Déplacer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mkdir */}
      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau dossier</DialogTitle></DialogHeader>
          <Input placeholder="Nom du dossier" value={mkdirVal} onChange={(e) => setMkdirVal(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMkdirOpen(false)}>Annuler</Button>
            <Button onClick={handleMkdir}><Plus className="mr-2 h-4 w-4" />Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
