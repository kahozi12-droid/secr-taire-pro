import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cloud, FolderTree, Search, BarChart3, RefreshCw, Shield, HardDrive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cloudInitYear, syncLocalToCloud, syncCloudToLocal } from "@/lib/scannerArchive";
import { logSync } from "@/lib/cloudActivity";
import { useLocalRoot, ensureLocalRoot } from "@/lib/localRootStore";
import { CloudExplorer } from "@/components/cloud/CloudExplorer";
import { CloudSync } from "@/components/cloud/CloudSync";
import { CloudSecurity } from "@/components/cloud/CloudSecurity";
import { CloudStatsAndSearch } from "@/components/cloud/CloudStatsAndSearch";

export const Route = createFileRoute("/_app/cloud")({
  component: CloudPage,
});

function CloudPage() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const { handle, name } = useLocalRoot();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [initBusy, setInitBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleInit = async () => {
    if (!uid) return;
    setInitBusy(true);
    try {
      await cloudInitYear(uid, year);
      toast.success(`Structure ${year} initialisée dans le cloud`);
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally { setInitBusy(false); }
  };

  const handleFullSync = async () => {
    if (!uid) return;
    if (!handle) { toast.error("Aucun dossier local connecté"); return; }
    setSyncBusy(true);
    const t0 = Date.now();
    try {
      const up = await syncLocalToCloud(uid, handle, year);
      const dn = await syncCloudToLocal(uid, handle, year);
      await logSync("both", String(year), up.uploaded + dn.downloaded, up.skipped + dn.skipped, 0, Date.now() - t0);
      toast.success(`Synchro: ↑${up.uploaded} ↓${dn.downloaded}`);
    } catch (e) {
      toast.error("Synchro échouée", { description: (e as Error).message });
    } finally { setSyncBusy(false); }
  };

  if (!uid) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Cloud className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Gestion de Cloud</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleInit} disabled={initBusy}>
            <FolderTree className="mr-2 h-4 w-4" />{initBusy ? "..." : "Initialiser structure"}
          </Button>
          <Button size="sm" onClick={handleFullSync} disabled={syncBusy}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncBusy ? "animate-spin" : ""}`} />Synchroniser tout
          </Button>
        </div>
      </div>

      {!handle && (
        <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <span className="flex items-center gap-2"><HardDrive className="h-4 w-4" />Aucun dossier local connecté (nécessaire pour la synchronisation).</span>
          <Button size="sm" variant="outline" onClick={ensureLocalRoot}>Connecter</Button>
        </CardContent></Card>
      )}
      {handle && (
        <p className="text-xs text-muted-foreground flex items-center gap-1"><HardDrive className="h-3 w-3" />Dossier local: {name}</p>
      )}

      <Tabs defaultValue="explorer">
        <TabsList>
          <TabsTrigger value="explorer"><FolderTree className="mr-2 h-4 w-4" />Explorateur</TabsTrigger>
          <TabsTrigger value="search"><Search className="mr-2 h-4 w-4" />Recherche & Stats</TabsTrigger>
          <TabsTrigger value="sync"><RefreshCw className="mr-2 h-4 w-4" />Synchronisation</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-2 h-4 w-4" />Sécurité</TabsTrigger>
        </TabsList>
        <TabsContent value="explorer"><CloudExplorer uid={uid} year={year} /></TabsContent>
        <TabsContent value="search"><CloudStatsAndSearch uid={uid} year={year} /></TabsContent>
        <TabsContent value="sync"><CloudSync uid={uid} year={year} /></TabsContent>
        <TabsContent value="security"><CloudSecurity uid={uid} /></TabsContent>
      </Tabs>
    </div>
  );
}
