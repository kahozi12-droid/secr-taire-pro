import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  cloudDownload,
  cloudUpload,
  walkCloud,
  localWriteFile,
  localReadFile,
} from "@/lib/scannerArchive";
import { logSync } from "@/lib/cloudActivity";
import { useLocalRoot, ensureLocalRoot } from "@/lib/localRootStore";
import { ArrowRight, ArrowLeft, RefreshCw, HardDrive, Cloud } from "lucide-react";

// helper: walk local scoped
async function walkLocalYear(root: FileSystemDirectoryHandle, year: number): Promise<string[]> {
  const out: string[] = [];
  async function rec(dir: FileSystemDirectoryHandle, rel: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, h] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
      const nrel = rel ? `${rel}/${name}` : name;
      if (h.kind === "directory") await rec(h as FileSystemDirectoryHandle, nrel);
      else if (name !== ".keep") out.push(nrel);
    }
  }
  try {
    const yearDir = await root.getDirectoryHandle(String(year), { create: false });
    await rec(yearDir, String(year));
  } catch {
    // no local year dir
  }
  return out;
}

export function CloudSync({ uid, year }: { uid: string; year: number }) {
  const { handle } = useLocalRoot();
  const [cloudList, setCloudList] = useState<string[] | null>(null);
  const [localList, setLocalList] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [logs, setLogs] = useState<Array<{ id: string; direction: string; scope: string; files_synced: number; errors: number; created_at: string }>>([]);

  const refresh = async () => {
    setBusy(true);
    try {
      const c = await walkCloud(uid, String(year));
      setCloudList(c);
      if (handle) setLocalList(await walkLocalYear(handle, year));
      else setLocalList(null);
    } finally {
      setBusy(false);
    }
    const { data } = await supabase
      .from("cloud_sync_log")
      .select("id,direction,scope,files_synced,errors,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs(data ?? []);
  };

  useEffect(() => { void refresh(); }, [uid, year, handle]);

  const diff = useMemo(() => {
    if (!cloudList || !localList) return null;
    const cloudSet = new Set(cloudList);
    const localSet = new Set(localList);
    return {
      both: cloudList.filter((p) => localSet.has(p)),
      onlyCloud: cloudList.filter((p) => !localSet.has(p)),
      onlyLocal: localList.filter((p) => !cloudSet.has(p)),
    };
  }, [cloudList, localList]);

  const runLocalToCloud = async () => {
    if (!handle || !diff) return;
    setBusy(true);
    const t0 = Date.now();
    let ok = 0, err = 0;
    setProgress({ done: 0, total: diff.onlyLocal.length, label: "" });
    for (let i = 0; i < diff.onlyLocal.length; i++) {
      const rel = diff.onlyLocal[i];
      setProgress({ done: i, total: diff.onlyLocal.length, label: rel });
      try {
        const f = await localReadFile(handle, rel);
        await cloudUpload(uid, rel, f);
        ok++;
      } catch { err++; }
    }
    await logSync("to_cloud", String(year), ok, 0, err, Date.now() - t0);
    setProgress(null); setBusy(false);
    toast.success(`Envoyés: ${ok}, erreurs: ${err}`);
    await refresh();
  };

  const runCloudToLocal = async () => {
    if (!handle || !diff) return;
    setBusy(true);
    const t0 = Date.now();
    let ok = 0, err = 0;
    setProgress({ done: 0, total: diff.onlyCloud.length, label: "" });
    for (let i = 0; i < diff.onlyCloud.length; i++) {
      const rel = diff.onlyCloud[i];
      setProgress({ done: i, total: diff.onlyCloud.length, label: rel });
      try {
        const blob = await cloudDownload(uid, rel);
        await localWriteFile(handle, rel, blob);
        ok++;
      } catch { err++; }
    }
    await logSync("to_local", String(year), ok, 0, err, Date.now() - t0);
    setProgress(null); setBusy(false);
    toast.success(`Téléchargés: ${ok}, erreurs: ${err}`);
    await refresh();
  };

  const runBoth = async () => { await runLocalToCloud(); await runCloudToLocal(); };

  return (
    <div className="space-y-4">
      {!handle && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm">Aucun dossier local connecté.</p>
            <Button onClick={async () => { await ensureLocalRoot(); await refresh(); }}>
              <HardDrive className="mr-2 h-4 w-4" />Connecter un dossier local
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={refresh} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Rafraîchir</Button>
        <Button onClick={runLocalToCloud} disabled={busy || !handle}><ArrowRight className="mr-2 h-4 w-4" />Envoyer vers cloud</Button>
        <Button onClick={runCloudToLocal} disabled={busy || !handle}><ArrowLeft className="mr-2 h-4 w-4" />Télécharger vers local</Button>
        <Button variant="default" onClick={runBoth} disabled={busy || !handle}><RefreshCw className="mr-2 h-4 w-4" />Tout synchroniser</Button>
      </div>

      {progress && (
        <Card><CardContent className="space-y-2 py-3">
          <p className="text-xs truncate">{progress.label || "…"}</p>
          <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
          <p className="text-xs text-muted-foreground">{progress.done} / {progress.total}</p>
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Cloud className="h-4 w-4" />+ <HardDrive className="h-4 w-4" /></CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{diff?.both.length ?? "-"}</p><p className="text-xs text-muted-foreground">Présents des deux côtés</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Cloud className="h-4 w-4" />Uniquement cloud</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{diff?.onlyCloud.length ?? "-"}</p><p className="text-xs text-muted-foreground">À télécharger localement</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><HardDrive className="h-4 w-4" />Uniquement local</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{diff?.onlyLocal.length ?? "-"}</p><p className="text-xs text-muted-foreground">À envoyer vers le cloud</p></CardContent></Card>
      </div>

      {diff && (
        <div className="grid gap-3 md:grid-cols-2">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Manquants dans le local</CardTitle></CardHeader>
            <CardContent className="max-h-64 overflow-auto text-xs space-y-1">
              {diff.onlyCloud.length === 0 ? <p className="text-muted-foreground">Aucun</p> : diff.onlyCloud.map((p) => <p key={p} className="truncate">{p}</p>)}
            </CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Manquants dans le cloud</CardTitle></CardHeader>
            <CardContent className="max-h-64 overflow-auto text-xs space-y-1">
              {diff.onlyLocal.length === 0 ? <p className="text-muted-foreground">Aucun</p> : diff.onlyLocal.map((p) => <p key={p} className="truncate">{p}</p>)}
            </CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Historique des synchronisations</CardTitle></CardHeader>
        <CardContent className="max-h-64 overflow-auto">
          {logs.length === 0 ? <p className="text-xs text-muted-foreground">Aucun historique</p> : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr><th className="text-left">Date</th><th className="text-left">Sens</th><th className="text-left">Portée</th><th className="text-right">Fichiers</th><th className="text-right">Erreurs</th></tr></thead>
              <tbody>{logs.map((l) => (
                <tr key={l.id} className="border-t"><td>{new Date(l.created_at).toLocaleString("fr-FR")}</td><td>{l.direction}</td><td>{l.scope}</td><td className="text-right">{l.files_synced}</td><td className="text-right">{l.errors}</td></tr>
              ))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
