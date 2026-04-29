import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { findSub } from "@/lib/classification";

// Outgoing documents use a simplified two-folder taxonomy (Technical / Administration).
const OUTGOING_CATEGORIES = {
  technical: { main: "TEC", sub: "TEC/OUT", color: "blue" as const },
  administration: { main: "ADM", sub: "ADM/OUT", color: "green" as const },
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScanCapture } from "@/components/ScanCapture";
import { CategoryPicker } from "@/components/CategoryPicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: "incoming" | "outgoing";
  onCreated: () => void;
}

export function NewDocumentDialog({ open, onOpenChange, type, onCreated }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sub, setSub] = useState("");
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [folder, setFolder] = useState<"technical" | "administration">("administration");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderNumber, setOrderNumber] = useState("");

  const reset = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setSub("");
    setSender("");
    setRecipient("");
    setFolder("administration");
    setDocDate(new Date().toISOString().slice(0, 10));
    setOrderNumber("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let mainCode: string;
    let subCode: string;
    let colorCode: string;

    if (type === "outgoing") {
      const c = OUTGOING_CATEGORIES[folder];
      mainCode = c.main;
      subCode = c.sub;
      colorCode = c.color;
    } else {
      if (!sub) return toast.error(t("subcategory") + " ?");
      const found = findSub(sub);
      if (!found) return toast.error("Invalid category");
      mainCode = found.cat.code;
      subCode = sub;
      colorCode = found.cat.color;
    }

    setBusy(true);
    try {
      // 1. Generate code
      const { data: code, error: codeErr } = await supabase.rpc("generate_reference_code", {
        _type: type,
        _category_sub: subCode,
      });
      if (codeErr) throw codeErr;

      // 2. Upload file (if any)
      let filePath: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${type}/${new Date().getFullYear()}/${code}.${ext}`.replace(/\s+/g, "_");
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;
        filePath = path;
        fileName = file.name;
        mimeType = file.type;
      }

      // 3. Insert row
      const { error: insErr } = await supabase.from("documents").insert({
        reference_code: code as string,
        type,
        title,
        description: description || null,
        category_main: mainCode,
        category_sub: subCode,
        color: colorCode,
        sender: type === "incoming" ? sender || null : null,
        recipient: type === "outgoing" ? recipient || null : null,
        outgoing_folder: type === "outgoing" ? folder : null,
        document_date: docDate,
        order_number: orderNumber || null,
        file_path: filePath,
        file_name: fileName,
        mime_type: mimeType,
        created_by: user.id,
      });
      if (insErr) throw insErr;

      toast.success(`${t("saved")} · ${code}`);
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("saveError");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{type === "incoming" ? t("newIncoming") : t("newOutgoing")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <ScanCapture value={file} onChange={setFile} />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="title">{t("title")}</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
            </div>

            {type === "incoming" ? (
              <div className="space-y-1">
                <Label htmlFor="sender">{t("sender")}</Label>
                <Input id="sender" value={sender} onChange={(e) => setSender(e.target.value)} maxLength={200} />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="recipient">{t("recipient")}</Label>
                  <Input id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1">
                  <Label>{t("folder")}</Label>
                  <Select value={folder} onValueChange={(v) => setFolder(v as "technical" | "administration")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="administration">{t("administration")}</SelectItem>
                      <SelectItem value="technical">{t("technical")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-1">
              <Label htmlFor="docdate">{t("documentDate")}</Label>
              <Input id="docdate" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label htmlFor="orderNumber">{t("orderNumber")}</Label>
              <Input id="orderNumber" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} maxLength={50} placeholder="ex: 001/2026" />
            </div>
          </div>

          {type === "incoming" && (
            <div className="space-y-1">
              <Label>{t("category")}</Label>
              <CategoryPicker value={sub} onChange={setSub} />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="desc">{t("description")}</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
