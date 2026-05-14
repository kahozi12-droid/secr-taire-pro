import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Folder, FolderOpen, Loader2, Printer, RefreshCw, RotateCcw, RotateCw, Trash2, FileText, Inbox as InboxIcon, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { printerForRole } from "@/lib/printers";
import { NewDocumentDialog } from "@/components/NewDocumentDialog";

export const Route = createFileRoute("/_app/scanner")({
  component: ScannerPage,
});

interface PendingScan {
  key: string; // unique: name + lastModified
  file: File;
  url: string; // object URL for preview
  rotation: 0 | 90 | 180 | 270;
  isImage: boolean;
}

const POLL_INTERVAL_MS = 4000;
const ACCEPTED_EXT = /\.(pdf|jpe?g|png|tiff?|bmp|webp)$/i;

function ScannerPage() {
  const { t, lang } = useI18n();
  const { role } = useAuth();
  const printer = printerForRole(role);

  const [supported] = useState(
    typeof window !== "undefined" && "showDirectoryPicker" in window,
  );
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const [folderName, setFolderName] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, setPending] = useState<PendingScan[]>([]);
  const [active, setActive] = useState<PendingScan | null>(null);
  const [classifyOpen, setClassifyOpen] = useState<"incoming" | "outgoing" | null>(null);

  const importFile = useCallback(async (handle: FileSystemFileHandle) => {
    try {
      const file = await handle.getFile();
      const key = `${file.name}::${file.lastModified}::${file.size}`;
      if (seenRef.current.has(key)) return;
      if (!ACCEPTED_EXT.test(file.name)) return;
      seenRef.current.add(key);
      const isImage = file.type.startsWith("image/");
      const url = URL.createObjectURL(file);
      setPending((prev) => {
        const next: PendingScan = { key, file, url, rotation: 0, isImage };
        toast.info(t("newScanDetected") + " · " + file.name);
        return [next, ...prev];
      });
    } catch {
      // ignore unreadable file
    }
  }, [t]);

  const scanFolder = useCallback(async () => {
    const handle = dirHandleRef.current;
    if (!handle) return;
    setScanning(true);
    try {
      const iter = (handle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values();
      for await (const entry of iter) {
        if (entry.kind === "file") {
          await importFile(entry as FileSystemFileHandle);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan error";
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  }, [importFile]);

  const connect = async () => {
    if (!supported) {
      toast.error(t("folderUnsupported"));
      return;
    }
    try {
      // @ts-expect-error showDirectoryPicker not yet in TS lib
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
        mode: "read",
        id: "scanner-folder",
      });
      dirHandleRef.current = handle;
      setFolderName(handle.name);
      seenRef.current = new Set();
      setPending([]);
      await scanFolder();
      toast.success(t("folderConnected") + " · " + handle.name);
    } catch {
      // user cancelled
    }
  };

  // Poll the folder while connected
  useEffect(() => {
    if (!folderName) return;
    const id = window.setInterval(() => {
      void scanFolder();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [folderName, scanFolder]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = (delta: 90 | -90) => {
    if (!active) return;
    const next = (((active.rotation + delta) % 360) + 360) % 360;
    const updated: PendingScan = { ...active, rotation: next as 0 | 90 | 180 | 270 };
    setActive(updated);
    setPending((prev) => prev.map((p) => (p.key === active.key ? updated : p)));
  };

  // Build a rotated File when needed (image only). PDF kept as-is.
  const finalizeFile = async (scan: PendingScan): Promise<File> => {
    if (!scan.isImage || scan.rotation === 0) return scan.file;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = scan.url;
    });
    const canvas = document.createElement("canvas");
    const swap = scan.rotation === 90 || scan.rotation === 270;
    canvas.width = swap ? img.height : img.width;
    canvas.height = swap ? img.width : img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((scan.rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), scan.file.type || "image/jpeg", 0.92));
    return new File([blob], scan.file.name, { type: blob.type, lastModified: Date.now() });
  };

  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const startClassify = async (type: "incoming" | "outgoing") => {
    if (!active) return;
    const finalized = await finalizeFile(active);
    setPendingFile(finalized);
    setClassifyOpen(type);
  };

  const discard = (key: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.key !== key);
    });
    if (active?.key === key) setActive(null);
  };

  const onClassified = () => {
    if (!active) return;
    discard(active.key);
    setClassifyOpen(null);
    setPendingFile(null);
  };

  return (
    <div className="space-y-6">
      {/* Printer header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="h-4 w-4" /> {t("assignedPrinter")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{printer.name}</p>
            <p className="text-xs text-muted-foreground">
              {lang === "fr" ? printer.description : printer.description_en} · <span className="font-mono">{printer.id}</span>
            </p>
          </div>
          <Badge variant={folderName ? "default" : "secondary"}>
            {folderName ? `${t("folderConnected")} · ${folderName}` : t("connectFolder")}
          </Badge>
        </CardContent>
      </Card>

      {/* Folder controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("scanner")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("folderHint")}</p>
          {!supported && (
            <p className="text-sm text-destructive">{t("folderUnsupported")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={connect} disabled={!supported} variant={folderName ? "outline" : "default"}>
              {folderName ? <FolderOpen className="mr-2 h-4 w-4" /> : <Folder className="mr-2 h-4 w-4" />}
              {folderName ? t("reconnectFolder") : t("connectFolder")}
            </Button>
            {folderName && (
              <Button onClick={scanFolder} variant="outline" disabled={scanning}>
                {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {t("refreshFolder")}
              </Button>
            )}
            {folderName && (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {t("autoWatching")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two-column: inbox + preview */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <InboxIcon className="h-4 w-4" /> {t("pendingScans")} ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noPendingScans")}</p>
            ) : (
              pending.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setActive(p)}
                  className={[
                    "flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors",
                    active?.key === p.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  ].join(" ")}
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{p.file.name}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {p.isImage ? "IMG" : "PDF"}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[400px]">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base truncate">
              {active ? active.file.name : t("preview")}
            </CardTitle>
            {active && (
              <div className="flex flex-wrap items-center gap-2">
                {active.isImage && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => rotate(-90)}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rotate(90)}>
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={() => discard(active.key)}>
                  <Trash2 className="mr-1 h-4 w-4" /> {t("discard")}
                </Button>
                <Button size="sm" onClick={() => startClassify("incoming")}>
                  <InboxIcon className="mr-1 h-4 w-4" /> {t("classifyAsIncoming")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => startClassify("outgoing")}>
                  <Send className="mr-1 h-4 w-4" /> {t("classifyAsOutgoing")}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!active ? (
              <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                {t("preview")}
              </div>
            ) : active.isImage ? (
              <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-md border border-border bg-muted/30 p-4">
                <img
                  src={active.url}
                  alt={active.file.name}
                  style={{ transform: `rotate(${active.rotation}deg)`, transition: "transform 0.2s" }}
                  className="max-h-[60vh] object-contain"
                />
              </div>
            ) : (
              <iframe
                title={active.file.name}
                src={active.url}
                className="h-[70vh] w-full rounded-md border border-border"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {classifyOpen && (
        <NewDocumentDialog
          open={!!classifyOpen}
          onOpenChange={(v) => {
            if (!v) {
              setClassifyOpen(null);
              setPendingFile(null);
            }
          }}
          type={classifyOpen}
          initialFile={pendingFile}
          onCreated={onClassified}
        />
      )}
    </div>
  );
}
