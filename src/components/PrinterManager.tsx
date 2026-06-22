import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, Plus, Trash2, Settings2, Folder, CheckCircle2, XCircle, Radar, Usb, Bluetooth, Wifi } from "lucide-react";
import { toast } from "sonner";

type DeviceKind = "printer" | "scanner" | "multifunction";

interface DeviceEntry {
  id: string;
  name: string;
  kind: DeviceKind;
  location?: string;
  folder?: string; // hint path (network share)
  defaultFor?: "main" | "director" | "";
  notes?: string;
}

interface BrowserCapabilities {
  name: string;
  fileSystemAccess: boolean;
  windowManagement: boolean;
  isSecureContext: boolean;
  inIframe: boolean;
}

const STORAGE_KEY = "devices:list:v1";
const FLAGS_KEY = "devices:flags:v1";

interface FeatureFlags {
  requestWindowManagement: boolean;
  allowIframeFallback: boolean;
  autoOpenInNewTab: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  requestWindowManagement: true,
  allowIframeFallback: true,
  autoOpenInNewTab: false,
};

function detectBrowser(): BrowserCapabilities {
  if (typeof window === "undefined") {
    return {
      name: "unknown",
      fileSystemAccess: false,
      windowManagement: false,
      isSecureContext: false,
      inIframe: false,
    };
  }
  const ua = navigator.userAgent;
  let name = "Inconnu";
  if (/Edg\//.test(ua)) name = "Microsoft Edge";
  else if (/OPR\/|Opera/.test(ua)) name = "Opera";
  else if (/Chrome\//.test(ua)) name = "Google Chrome";
  else if (/Firefox\//.test(ua)) name = "Mozilla Firefox";
  else if (/Safari\//.test(ua)) name = "Safari";
  return {
    name,
    fileSystemAccess: "showDirectoryPicker" in window,
    windowManagement: "getScreenDetails" in window,
    isSecureContext: window.isSecureContext,
    inIframe: window.self !== window.top,
  };
}

function loadDevices(): DeviceEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveDevices(list: DeviceEntry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function loadFlags(): FeatureFlags {
  if (typeof window === "undefined") return DEFAULT_FLAGS;
  try {
    return { ...DEFAULT_FLAGS, ...JSON.parse(window.localStorage.getItem(FLAGS_KEY) || "{}") };
  } catch {
    return DEFAULT_FLAGS;
  }
}
function saveFlags(f: FeatureFlags) {
  window.localStorage.setItem(FLAGS_KEY, JSON.stringify(f));
}

interface DetectedDevice {
  name: string;
  source: "USB" | "Bluetooth" | "Réseau";
  details: string;
  kind: DeviceKind;
  folder?: string;
}

export default function PrinterManager() {
  const caps = useMemo(detectBrowser, []);
  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [editing, setEditing] = useState<DeviceEntry | null>(null);
  const [detected, setDetected] = useState<DetectedDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [networkBase, setNetworkBase] = useState("192.168.1");
  const hasUsb = typeof navigator !== "undefined" && "usb" in navigator;
  const hasBluetooth = typeof navigator !== "undefined" && "bluetooth" in navigator;
  const [form, setForm] = useState<DeviceEntry>({
    id: "",
    name: "",
    kind: "printer",
    location: "",
    folder: "",
    defaultFor: "",
    notes: "",
  });

  useEffect(() => {
    setDevices(loadDevices());
    setFlags(loadFlags());
  }, []);

  const resetForm = () => {
    setForm({ id: "", name: "", kind: "printer", location: "", folder: "", defaultFor: "", notes: "" });
    setEditing(null);
  };

  const submit = () => {
    if (!form.name.trim()) return toast.error("Nom requis");
    let next: DeviceEntry[];
    if (editing) {
      next = devices.map((d) => (d.id === editing.id ? { ...form, id: editing.id } : d));
      toast.success("Périphérique mis à jour");
    } else {
      next = [...devices, { ...form, id: crypto.randomUUID() }];
      toast.success("Périphérique ajouté");
    }
    setDevices(next);
    saveDevices(next);
    resetForm();
  };

  const startEdit = (d: DeviceEntry) => {
    setEditing(d);
    setForm(d);
  };

  const remove = (id: string) => {
    const next = devices.filter((d) => d.id !== id);
    setDevices(next);
    saveDevices(next);
    toast.success("Périphérique supprimé");
  };

  const toggleFlag = (k: keyof FeatureFlags, v: boolean) => {
    const next = { ...flags, [k]: v };
    setFlags(next);
    saveFlags(next);
  };

  const requestWindowManagement = async () => {
    if (!("getScreenDetails" in window)) {
      return toast.error("Non supporté par ce navigateur");
    }
    try {
      // @ts-expect-error experimental API
      const details = await window.getScreenDetails();
      toast.success(`Window-management accordé (${details.screens.length} écran(s))`);
    } catch (e) {
      toast.error("Permission refusée");
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      {/* Browser capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" /> Compatibilité du navigateur
          </CardTitle>
          <CardDescription>
            Détection des fonctionnalités requises pour la connexion automatique aux imprimantes/scanners.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{caps.name}</Badge>
            <CapBadge label="File System Access" ok={caps.fileSystemAccess} />
            <CapBadge label="Window Management" ok={caps.windowManagement} />
            <CapBadge label="Contexte sécurisé" ok={caps.isSecureContext} />
            <CapBadge label="Hors iframe" ok={!caps.inIframe} />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Demander la permission « window-management »</p>
              <p className="text-xs text-muted-foreground">
                Active la détection multi-écrans pour orienter l'impression vers le bon écran (Chrome, Edge, Opera).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={flags.requestWindowManagement}
                onCheckedChange={(v) => toggleFlag("requestWindowManagement", v)}
              />
              <Button size="sm" variant="outline" onClick={requestWindowManagement} disabled={!caps.windowManagement}>
                Demander
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Autoriser le repli iframe</p>
              <p className="text-xs text-muted-foreground">
                Si la connexion directe échoue (Safari, Firefox, aperçu), utiliser l'import manuel de fichiers.
              </p>
            </div>
            <Switch
              checked={flags.allowIframeFallback}
              onCheckedChange={(v) => toggleFlag("allowIframeFallback", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Ouvrir dans un nouvel onglet par défaut</p>
              <p className="text-xs text-muted-foreground">
                Contourne les restrictions d'aperçu en chargeant l'app dans un onglet complet.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={flags.autoOpenInNewTab}
                onCheckedChange={(v) => toggleFlag("autoOpenInNewTab", v)}
              />
              <Button size="sm" variant="outline" onClick={openInNewTab}>
                Ouvrir maintenant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Devices list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" /> Imprimantes & scanners
          </CardTitle>
          <CardDescription>Ajoutez et configurez vos périphériques.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun périphérique configuré.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {devices.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <Badge variant="secondary" className="text-xs">{d.kind}</Badge>
                      {d.defaultFor && (
                        <Badge variant="outline" className="text-xs">
                          défaut : {d.defaultFor === "director" ? "Directeur" : "Secrétariat"}
                        </Badge>
                      )}
                    </div>
                    {d.location && <p className="text-xs text-muted-foreground">📍 {d.location}</p>}
                    {d.folder && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Folder className="h-3 w-3" /> {d.folder}
                      </p>
                    )}
                    {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(d)}>
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(d.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Auto-detection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5" /> Détection automatique
          </CardTitle>
          <CardDescription>
            Recherchez les imprimantes/scanners connectés via USB, Bluetooth ou le réseau local. Le navigateur affichera une boîte de dialogue système pour autoriser l'accès.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={detectUsb} disabled={!hasUsb}>
              <Usb className="mr-2 h-4 w-4" /> Détecter via USB
            </Button>
            <Button variant="outline" onClick={detectBluetooth} disabled={!hasBluetooth}>
              <Bluetooth className="mr-2 h-4 w-4" /> Détecter via Bluetooth
            </Button>
            <Button variant="outline" onClick={detectNetwork} disabled={scanning}>
              <Wifi className="mr-2 h-4 w-4" /> {scanning ? "Analyse…" : "Scan réseau (IPP)"}
            </Button>
            {networkBase && (
              <Input
                className="w-48"
                value={networkBase}
                onChange={(e) => setNetworkBase(e.target.value)}
                placeholder="192.168.1"
              />
            )}
          </div>
          {!hasUsb && !hasBluetooth && (
            <p className="text-xs text-muted-foreground">
              WebUSB et Web Bluetooth ne sont disponibles que dans Chrome, Edge et Opera (hors aperçu/iframe).
            </p>
          )}
          {detected.length > 0 && (
            <ul className="divide-y rounded-md border">
              {detected.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.source} · {d.details}</p>
                  </div>
                  <Button size="sm" onClick={() => fillFromDetected(d)}>
                    Pré-remplir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add / edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {editing ? "Configurer le périphérique" : "Ajouter une imprimante / scanner"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: HP LaserJet Secrétariat"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v as DeviceKind })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="printer">Imprimante</SelectItem>
                  <SelectItem value="scanner">Scanner</SelectItem>
                  <SelectItem value="multifunction">Multifonction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Emplacement</Label>
              <Input
                value={form.location ?? ""}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Ex: Bureau du Directeur"
              />
            </div>
            <div className="space-y-2">
              <Label>Dossier réseau (scans)</Label>
              <Input
                value={form.folder ?? ""}
                onChange={(e) => setForm({ ...form, folder: e.target.value })}
                placeholder="\\\\serveur\\scans\\direction"
              />
            </div>
            <div className="space-y-2">
              <Label>Assigné par défaut à</Label>
              <Select
                value={form.defaultFor || "none"}
                onValueChange={(v) => setForm({ ...form, defaultFor: v === "none" ? "" : (v as "main" | "director") })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  <SelectItem value="main">Secrétariat</SelectItem>
                  <SelectItem value="director">Directeur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Input
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Modèle, IP, pilote…"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={submit}>{editing ? "Enregistrer" : "Ajouter"}</Button>
            {editing && (
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CapBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge variant={ok ? "default" : "secondary"} className="gap-1">
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );
}
