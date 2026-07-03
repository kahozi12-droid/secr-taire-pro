// Dialog offered after a document is marked "ready for treatment"
// (processed). Lets the user choose to archive it in the CLOUD mirror
// (Supabase Storage) OR in the LOCAL mirror on their PC (File System Access),
// or both — for sensitivity reasons.

import { useState } from "react";
import { Cloud, HardDrive, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { cloudUpload, localWriteFile } from "@/lib/scannerArchive";
import { archiveRelativePath } from "@/lib/archivePath";
import { ensureLocalRoot, getLocalRootName, useLocalRoot } from "@/lib/localRootStore";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc: Tables<"documents"> | null;
  onDone?: () => void;
}

async function fetchDocFile(path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from("documents").download(path);
  if (error) { toast.error(error.message); return null; }
  return data;
}

export function ArchiveChoiceDialog({ open, onOpenChange, doc, onDone }: Props) {
  const { user } = useAuth();
  const { name: localName } = useLocalRoot();
  const [busy, setBusy] = useState<"cloud" | "local" | "both" | null>(null);

  const saveCloud = async () => {
    if (!doc || !user || !doc.file_path) return;
    setBusy("cloud");
    try {
      const blob = await fetchDocFile(doc.file_path);
      if (!blob) return;
      const rel = archiveRelativePath(doc);
      const file = new File([blob], rel.split("/").pop()!, { type: doc.mime_type ?? "application/octet-stream" });
      await cloudUpload(user.id, rel, file);
      toast.success("Document archivé dans le cloud");
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(null); }
  };

  const saveLocal = async () => {
    if (!doc || !doc.file_path) return;
    setBusy("local");
    try {
      const root = await ensureLocalRoot();
      if (!root) { setBusy(null); return; }
      const blob = await fetchDocFile(doc.file_path);
      if (!blob) return;
      const rel = archiveRelativePath(doc);
      await localWriteFile(root, rel, blob);
      toast.success(`Document enregistré localement (${getLocalRootName()})`);
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(null); }
  };

  const saveBoth = async () => {
    if (!doc || !user || !doc.file_path) return;
    setBusy("both");
    try {
      const root = await ensureLocalRoot();
      const blob = await fetchDocFile(doc.file_path);
      if (!blob) return;
      const rel = archiveRelativePath(doc);
      const file = new File([blob], rel.split("/").pop()!, { type: doc.mime_type ?? "application/octet-stream" });
      await cloudUpload(user.id, rel, file);
      if (root) await localWriteFile(root, rel, blob);
      toast.success(root ? "Document archivé (cloud + local)" : "Document archivé dans le cloud (local ignoré)");
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Où archiver ce document ?
          </DialogTitle>
          <DialogDescription>
            Le document a été marqué comme <b>traité</b>. Pour raisons de sensibilité,
            choisissez son emplacement d'archivage. La structure (année / mois / catégorie)
            est appliquée automatiquement.
          </DialogDescription>
        </DialogHeader>

        {doc && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-mono text-xs text-muted-foreground">{doc.reference_code}</p>
            <p className="font-medium">{doc.title}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              → {archiveRelativePath(doc)}
            </p>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" className="h-auto flex-col items-start gap-1 py-3" disabled={busy !== null} onClick={saveCloud}>
            <div className="flex items-center gap-2">
              {busy === "cloud" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
              <span className="font-semibold">Cloud</span>
            </div>
            <span className="text-left text-xs font-normal text-muted-foreground">
              Accessible depuis n'importe quel PC autorisé
            </span>
          </Button>
          <Button variant="outline" className="h-auto flex-col items-start gap-1 py-3" disabled={busy !== null} onClick={saveLocal}>
            <div className="flex items-center gap-2">
              {busy === "local" ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
              <span className="font-semibold">PC local {localName ? `(${localName})` : ""}</span>
            </div>
            <span className="text-left text-xs font-normal text-muted-foreground">
              Reste sur cette machine — plus confidentiel
            </span>
          </Button>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy !== null}>
            Ignorer
          </Button>
          <Button onClick={saveBoth} disabled={busy !== null}>
            {busy === "both" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enregistrer dans les deux
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
