import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cloudRestore, cloudPurge, formatBytes } from "@/lib/scannerArchive";
import { logCloudActivity } from "@/lib/cloudActivity";
import { useAuth } from "@/providers/AuthProvider";
import { RotateCcw, Trash2 } from "lucide-react";

interface TrashItem {
  id: string;
  original_path: string;
  trashed_path: string;
  size: number;
  trashed_at: string;
  trashed_by: string;
  auto_purge_at: string;
}

interface ActivityItem {
  id: string;
  user_id: string;
  action: string;
  path: string | null;
  target_path: string | null;
  bytes: number | null;
  created_at: string;
}

export function CloudSecurity({ uid }: { uid: string }) {
  const { role } = useAuth();
  const isDirector = role === "director";
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    const t = await supabase.from("cloud_trash").select("*").order("trashed_at", { ascending: false });
    setTrash((t.data as TrashItem[] | null) ?? []);
    const a = await supabase.from("cloud_activity_log").select("*").order("created_at", { ascending: false }).limit(200);
    setActivity((a.data as ActivityItem[] | null) ?? []);
  };
  useEffect(() => { void load(); }, [uid]);

  const restore = async (item: TrashItem) => {
    try {
      await cloudRestore(uid, item.trashed_path, item.original_path);
      await supabase.from("cloud_trash").delete().eq("id", item.id);
      await logCloudActivity("restore", item.trashed_path, item.original_path, item.size);
      toast.success("Restauré");
      await load();
    } catch (e) {
      toast.error("Restauration impossible", { description: (e as Error).message });
    }
  };

  const purge = async (item: TrashItem) => {
    if (!isDirector) { toast.error("Réservé au directeur"); return; }
    if (!confirm("Supprimer définitivement ce fichier ?")) return;
    try {
      await cloudPurge(uid, item.trashed_path);
      await supabase.from("cloud_trash").delete().eq("id", item.id);
      await logCloudActivity("purge", item.trashed_path, null, item.size);
      toast.success("Supprimé définitivement");
      await load();
    } catch (e) {
      toast.error("Suppression impossible", { description: (e as Error).message });
    }
  };

  const filteredActivity = activity.filter((a) => filter === "all" || a.action === filter);
  const actions = ["all", "upload", "download", "delete", "restore", "purge", "rename", "move", "mkdir", "sync"];

  return (
    <Tabs defaultValue="trash">
      <TabsList>
        <TabsTrigger value="trash">Corbeille</TabsTrigger>
        <TabsTrigger value="activity">Journal d'activité</TabsTrigger>
        <TabsTrigger value="perms">Permissions</TabsTrigger>
      </TabsList>

      <TabsContent value="trash" className="space-y-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Fichiers dans la corbeille ({trash.length})</CardTitle></CardHeader>
          <CardContent>
            {trash.length === 0 ? <p className="text-sm text-muted-foreground">Corbeille vide.</p> : (
              <div className="space-y-1">
                {trash.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 rounded border p-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{it.original_path}</p>
                      <p className="text-muted-foreground">{new Date(it.trashed_at).toLocaleString("fr-FR")} · {formatBytes(it.size)} · purge auto: {new Date(it.auto_purge_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => restore(it)}><RotateCcw className="mr-1 h-3 w-3" />Restaurer</Button>
                    <Button size="sm" variant="destructive" disabled={!isDirector} onClick={() => purge(it)} title={isDirector ? "" : "Réservé au directeur"}><Trash2 className="mr-1 h-3 w-3" />Purger</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="activity" className="space-y-2">
        <div className="flex gap-1 flex-wrap">
          {actions.map((a) => (
            <Button key={a} size="sm" variant={filter === a ? "default" : "outline"} onClick={() => setFilter(a)}>{a}</Button>
          ))}
        </div>
        <Card>
          <CardContent className="max-h-[500px] overflow-auto p-0">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Action</th><th className="p-2 text-left">Chemin</th><th className="p-2 text-right">Taille</th></tr></thead>
              <tbody>
                {filteredActivity.map((a) => (
                  <tr key={a.id} className="border-t"><td className="p-2">{new Date(a.created_at).toLocaleString("fr-FR")}</td>
                    <td className="p-2"><Badge variant="outline">{a.action}</Badge></td>
                    <td className="p-2"><p className="truncate max-w-[400px]">{a.path}{a.target_path ? ` → ${a.target_path}` : ""}</p></td>
                    <td className="p-2 text-right">{a.bytes ? formatBytes(a.bytes) : "-"}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="perms">
        <Card><CardContent className="space-y-2 py-4 text-sm">
          <p><strong>Directeur</strong> : accès complet — lecture, écriture, suppression, purge définitive de la corbeille.</p>
          <p><strong>Secrétaire</strong> : lecture, téléversement, téléchargement, renommage, déplacement, envoi à la corbeille. Ne peut pas purger définitivement.</p>
          <p className="text-muted-foreground text-xs">Les permissions sont basées sur les rôles utilisateurs et appliquées côté base de données (RLS).</p>
        </CardContent></Card>
      </TabsContent>
    </Tabs>
  );
}
