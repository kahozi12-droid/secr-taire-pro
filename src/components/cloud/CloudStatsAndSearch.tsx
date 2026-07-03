import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cloudWalkAll, computeStats, formatBytes, cloudSignedUrl, type CloudFileEntry } from "@/lib/scannerArchive";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";
import { Loader2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function CloudStatsAndSearch({ uid, year }: { uid: string; year: number }) {
  const [files, setFiles] = useState<CloudFileEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    cloudWalkAll(uid, String(year)).then(setFiles).finally(() => setLoading(false));
  }, [uid, year]);

  const stats = useMemo(() => (files ? computeStats(files) : null), [files]);

  const results = useMemo(() => {
    if (!files) return [];
    const s = q.trim().toLowerCase();
    if (!s) return files.slice(0, 100);
    return files.filter((f) => f.name.toLowerCase().includes(s) || f.path.toLowerCase().includes(s)).slice(0, 200);
  }, [files, q]);

  const openPreview = async (rel: string, name: string) => {
    try { setPreview({ url: await cloudSignedUrl(uid, rel, 300), name }); }
    catch (e) { toast.error("Aperçu impossible", { description: (e as Error).message }); }
  };

  if (loading) return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analyse en cours…</div>;
  if (!stats) return null;

  const groupData = Object.entries(stats.byGroup).map(([k, v]) => ({ name: k, fichiers: v.files }));
  const monthData = Object.entries(stats.byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ name: k, fichiers: v.files }));
  const topSub = Object.entries(stats.bySub).sort(([, a], [, b]) => b.files - a.files).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total fichiers</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{stats.totalFiles}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Taille totale</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{formatBytes(stats.totalBytes)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Année</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{year}</p></CardContent></Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Par groupe</CardTitle></CardHeader>
          <CardContent style={{ height: 220 }}>
            <ResponsiveContainer><BarChart data={groupData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="fichiers" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer>
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Par mois</CardTitle></CardHeader>
          <CardContent style={{ height: 220 }}>
            <ResponsiveContainer><AreaChart data={monthData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={9} interval={0} angle={-30} textAnchor="end" height={50} /><YAxis fontSize={11} /><Tooltip /><Area dataKey="fichiers" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" /></AreaChart></ResponsiveContainer>
          </CardContent></Card>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 sous-catégories</CardTitle></CardHeader>
        <CardContent>
          {topSub.length === 0 ? <p className="text-sm text-muted-foreground">Aucune donnée</p> : (
            <ul className="space-y-1 text-sm">{topSub.map(([k, v]) => (
              <li key={k} className="flex justify-between border-b py-1"><span>{k}</span><span className="text-muted-foreground">{v.files} fichiers · {formatBytes(v.bytes)}</span></li>
            ))}</ul>
          )}
        </CardContent></Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recherche dans l'archive {year}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Nom de fichier ou chemin…" value={q} onChange={(e) => setQ(e.target.value)} />
          <p className="text-xs text-muted-foreground">{results.length} résultat(s){q ? "" : " (100 premiers)"}</p>
          <div className="max-h-96 overflow-auto rounded border">
            {results.map((f) => (
              <div key={f.path} className="flex items-center gap-2 border-b px-2 py-1 text-xs last:border-b-0">
                <span className="flex-1 truncate">{f.path}</span>
                <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                <Button size="icon" variant="ghost" onClick={() => openPreview(f.path, f.name)}><Eye className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle className="truncate">{preview?.name}</DialogTitle></DialogHeader>
          {preview && <iframe src={preview.url} className="h-[70vh] w-full rounded border" title={preview.name} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
