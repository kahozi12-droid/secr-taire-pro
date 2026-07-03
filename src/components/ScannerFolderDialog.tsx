import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  Download,
  Folder,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  Wand2,
  ArrowUp,
  FileText,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/providers/AuthProvider";
import {
  cloudDelete,
  cloudInitYear,
  cloudList,
  cloudSignedUrl,
  cloudUpload,
  fsSupported,
  localDelete,
  localInitYear,
  localList,
  localWriteFile,
  pickLocalRoot,
  syncCloudToLocal,
  syncLocalToCloud,
} from "@/lib/scannerArchive";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called back when the user picks a local root — parent may wire it into the watcher. */
  onLocalRootChange?: (handle: FileSystemDirectoryHandle | null, name: string | null) => void;
}

type Entry =
  | { kind: "folder"; name: string; path: string }
  | { kind: "file"; name: string; path: string; size: number };

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

export function ScannerFolderDialog({ open, onOpenChange, onLocalRootChange }: Props) {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const [tab, setTab] = useState<"cloud" | "local">("cloud");
  const [year, setYear] = useState<number>(new Date().getFullYear());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" /> Connecter le dossier du scanner
          </DialogTitle>
          <DialogDescription>
            Deux emplacements miroir : le <b>Cloud</b> (accessible partout) et le dossier <b>local</b>
            {" "}sur ce PC. Structure automatique par année → mois → Courriers Entrants / Sortants → sous-catégorie.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-2">
          <label className="text-sm text-muted-foreground">Année :</label>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "cloud" | "local")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cloud"><Cloud className="mr-2 h-4 w-4" />Cloud</TabsTrigger>
            <TabsTrigger value="local"><HardDrive className="mr-2 h-4 w-4" />PC local</TabsTrigger>
          </TabsList>

          <TabsContent value="cloud" className="pt-3">
            <CloudPanel uid={uid} year={year} />
          </TabsContent>
          <TabsContent value="local" className="pt-3">
            <LocalPanel uid={uid} year={year} onLocalRootChange={onLocalRootChange} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// CLOUD panel
// -----------------------------------------------------------------------------
function CloudPanel({ uid, year }: { uid: string; year: number }) {
  const [cwd, setCwd] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initProgress, setInitProgress] = useState<number | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const { folders, files } = await cloudList(uid, cwd);
      const es: Entry[] = [
        ...folders.map<Entry>((f) => ({ kind: "folder" as const, name: f.name, path: f.path })),
        ...files.map<Entry>((f) => ({ kind: "file" as const, name: f.name, path: f.path, size: f.size })),
      ];
      setEntries(es);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur cloud");
    } finally {
      setLoading(false);
    }
  }, [uid, cwd]);

  useEffect(() => { void load(); }, [load]);

  const init = async () => {
    if (!confirm(`Créer la structure ${year} dans le cloud ? (12 mois × Entrants/Sortants × sous-catégories)`)) return;
    setInitProgress(0);
    try {
      await cloudInitYear(uid, year, (n, total) => setInitProgress(Math.round((n / total) * 100)));
      toast.success(`Structure ${year} initialisée dans le cloud`);
      setCwd(String(year));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setInitProgress(null);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    try {
      for (const f of files) {
        await cloudUpload(uid, cwd ? `${cwd}/${f.name}` : f.name, f);
      }
      toast.success(`${files.length} fichier(s) envoyé(s)`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi échoué");
    }
  };

  const openFile = async (path: string) => {
    try {
      const url = await cloudSignedUrl(uid, path, 300);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'ouvrir");
    }
  };

  const removeEntry = async (path: string, name: string) => {
    if (!confirm(`Supprimer "${name}" du cloud ?`)) return;
    try {
      await cloudDelete(uid, [path]);
      toast.success("Supprimé");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression échouée");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={init} disabled={!uid || initProgress !== null}>
          {initProgress !== null
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{initProgress}%</>
            : <><Wand2 className="mr-2 h-4 w-4" />Initialiser structure {year}</>}
        </Button>
        <Button size="sm" variant="outline" onClick={() => uploadRef.current?.click()} disabled={!uid}>
          <Upload className="mr-2 h-4 w-4" />Envoyer ici
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Rafraîchir
        </Button>
        <input ref={uploadRef} type="file" multiple hidden onChange={onUpload} />
        <Badge variant="outline" className="ml-auto"><Cloud className="mr-1 h-3 w-3" />Contrôle complet du cloud</Badge>
      </div>
      <Breadcrumb cwd={cwd} onNavigate={setCwd} rootLabel="Cloud" />
      <EntryList
        entries={entries}
        loading={loading}
        onEnterFolder={(p) => setCwd(p)}
        onOpenFile={openFile}
        onDelete={removeEntry}
        emptyLabel={cwd ? "Dossier vide" : "Aucune archive dans le cloud. Cliquez sur « Initialiser structure »."}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// LOCAL panel
// -----------------------------------------------------------------------------
function LocalPanel({
  uid,
  year,
  onLocalRootChange,
}: {
  uid: string;
  year: number;
  onLocalRootChange?: (handle: FileSystemDirectoryHandle | null, name: string | null) => void;
}) {
  const supported = useMemo(fsSupported, []);
  const rootRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [rootName, setRootName] = useState<string | null>(null);
  const [cwd, setCwd] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const root = rootRef.current;
    if (!root) { setEntries([]); return; }
    try {
      const { folders, files } = await localList(root, cwd);
      const es: Entry[] = [
        ...folders.map<Entry>((n) => ({ kind: "folder" as const, name: n, path: cwd ? `${cwd}/${n}` : n })),
        ...files.map<Entry>((f) => ({ kind: "file" as const, name: f.name, path: cwd ? `${cwd}/${f.name}` : f.name, size: f.size })),
      ];
      setEntries(es);
    } catch {
      setEntries([]);
    }
  }, [cwd]);

  useEffect(() => { void load(); }, [load]);

  const pick = async () => {
    const h = await pickLocalRoot();
    if (!h) return;
    rootRef.current = h;
    setRootName(h.name);
    onLocalRootChange?.(h, h.name);
    setCwd("");
    void load();
    toast.success(`Dossier local connecté : ${h.name}`);
  };

  const init = async () => {
    if (!rootRef.current) { toast.error("Choisissez d'abord un dossier"); return; }
    if (!confirm(`Créer la structure ${year} dans "${rootName}" ?`)) return;
    setBusy("init");
    try {
      await localInitYear(rootRef.current, year);
      toast.success(`Structure ${year} créée localement`);
      setCwd(String(year));
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(null); }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const root = rootRef.current;
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!root || files.length === 0) return;
    try {
      for (const f of files) await localWriteFile(root, cwd ? `${cwd}/${f.name}` : f.name, f);
      toast.success(`${files.length} fichier(s) ajouté(s)`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ajout échoué");
    }
  };

  const removeEntry = async (path: string, name: string) => {
    const root = rootRef.current;
    if (!root) return;
    if (!confirm(`Supprimer "${name}" localement ?`)) return;
    try {
      await localDelete(root, path);
      toast.success("Supprimé");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression échouée");
    }
  };

  const push = async () => {
    const root = rootRef.current;
    if (!root || !uid) return;
    setBusy("push");
    try {
      const res = await syncLocalToCloud(uid, root, year);
      toast.success(`Envoi terminé : ${res.uploaded} ajouté(s), ${res.skipped} déjà présent(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync échouée");
    } finally { setBusy(null); }
  };

  const pull = async () => {
    const root = rootRef.current;
    if (!root || !uid) return;
    setBusy("pull");
    try {
      const res = await syncCloudToLocal(uid, root, year);
      toast.success(`Téléchargement terminé : ${res.downloaded} nouveaux, ${res.skipped} déjà présents`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync échouée");
    } finally { setBusy(null); }
  };

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Votre navigateur ne prend pas en charge l'API File System Access. Utilisez Chrome ou Edge, ou l'agent local DigiCab.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={pick} variant={rootName ? "outline" : "default"}>
          {rootName ? <FolderOpen className="mr-2 h-4 w-4" /> : <Folder className="mr-2 h-4 w-4" />}
          {rootName ? `Dossier : ${rootName}` : "Choisir un dossier local"}
        </Button>
        <Button size="sm" onClick={init} disabled={!rootName || busy !== null}>
          {busy === "init" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Initialiser structure {year}
        </Button>
        <Button size="sm" variant="outline" onClick={() => uploadRef.current?.click()} disabled={!rootName}>
          <Upload className="mr-2 h-4 w-4" />Ajouter ici
        </Button>
        <input ref={uploadRef} type="file" multiple hidden onChange={onUpload} />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2">
        <span className="text-xs text-muted-foreground">Synchronisation {year} :</span>
        <Button size="sm" variant="secondary" onClick={push} disabled={!rootName || !uid || busy !== null}>
          {busy === "push" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Envoyer vers le cloud
        </Button>
        <Button size="sm" variant="secondary" onClick={pull} disabled={!rootName || !uid || busy !== null}>
          {busy === "pull" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Télécharger depuis le cloud
        </Button>
      </div>
      {rootName && (
        <>
          <Breadcrumb cwd={cwd} onNavigate={setCwd} rootLabel={rootName} />
          <EntryList
            entries={entries}
            loading={false}
            onEnterFolder={(p) => setCwd(p)}
            onOpenFile={async (p) => {
              const root = rootRef.current!;
              const parts = p.split("/").filter(Boolean);
              const fileName = parts.pop()!;
              let cur: FileSystemDirectoryHandle = root;
              for (const s of parts) cur = await cur.getDirectoryHandle(s, { create: false });
              const fh = await cur.getFileHandle(fileName, { create: false });
              const file = await fh.getFile();
              const url = URL.createObjectURL(file);
              window.open(url, "_blank", "noopener");
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
            }}
            onDelete={removeEntry}
            emptyLabel={cwd ? "Dossier vide" : "Aucun contenu. Cliquez sur « Initialiser structure »."}
          />
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Shared UI
// -----------------------------------------------------------------------------
function Breadcrumb({
  cwd,
  onNavigate,
  rootLabel,
}: {
  cwd: string;
  onNavigate: (p: string) => void;
  rootLabel: string;
}) {
  const parts = cwd.split("/").filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      {cwd && (
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => {
          const up = parts.slice(0, -1).join("/");
          onNavigate(up);
        }}>
          <ArrowUp className="mr-1 h-3 w-3" />
        </Button>
      )}
      <button className="text-muted-foreground hover:underline" onClick={() => onNavigate("")}>
        {rootLabel}
      </button>
      {parts.map((p, i) => {
        const path = parts.slice(0, i + 1).join("/");
        return (
          <span key={path} className="flex items-center gap-1">
            <span className="text-muted-foreground">/</span>
            <button className="hover:underline" onClick={() => onNavigate(path)}>{p}</button>
          </span>
        );
      })}
    </div>
  );
}

function EntryList({
  entries,
  loading,
  onEnterFolder,
  onOpenFile,
  onDelete,
  emptyLabel,
}: {
  entries: Entry[];
  loading: boolean;
  onEnterFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
  onDelete: (path: string, name: string) => void;
  emptyLabel: string;
}) {
  return (
    <div className="max-h-[380px] overflow-y-auto rounded-md border">
      {loading && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />Chargement…
        </div>
      )}
      {!loading && entries.length === 0 && (
        <p className="p-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      )}
      {!loading && entries.map((e) => (
        <div key={e.path} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40">
          {e.kind === "folder" ? (
            <>
              <button className="flex flex-1 items-center gap-2 text-left text-sm" onClick={() => onEnterFolder(e.path)}>
                <Folder className="h-4 w-4 text-primary" />
                <span className="font-medium">{e.name}</span>
              </button>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{e.name}</span>
              <span className="text-xs text-muted-foreground">{fmtSize(e.size)}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onOpenFile(e.path)} title="Ouvrir">
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(e.path, e.name)} title="Supprimer">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
