import type { Tables } from "@/integrations/supabase/types";
import { useState } from "react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { FileText, Download, CheckCircle2, Archive, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/CategoryPicker";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { ArchiveChoiceDialog } from "@/components/ArchiveChoiceDialog";

export type DocumentRow = Tables<"documents">;

interface Props {
  doc: DocumentRow;
  onChanged: () => void;
  showPostpone?: boolean;
}

export function DocumentRowCard({ doc, onChanged, showPostpone }: Props) {
  const { t, lang } = useI18n();
  const { role } = useAuth();
  const isSecretary = role === "secretary";
  const locale = lang === "fr" ? fr : enUS;

  const open = async () => {
    if (!doc.file_path) return;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60 * 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const [archiveOpen, setArchiveOpen] = useState(false);

  const updateStatus = async (status: "processed" | "archived") => {
    const { error } = await supabase.from("documents").update({ status }).eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    onChanged();
    if (status === "processed") setArchiveOpen(true);
  };

  const statusInfo = {
    pending: { label: t("statusPending"), Icon: Clock, cls: "bg-warning/15 text-warning border-warning/30" },
    processed: { label: t("statusProcessed"), Icon: CheckCircle2, cls: "bg-success/15 text-success border-success/30" },
    archived: { label: t("statusArchived"), Icon: Archive, cls: "bg-muted text-muted-foreground border-border" },
  }[doc.status];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <CategoryBadge code={doc.category_sub} />
            <Badge variant="outline" className="font-mono text-xs">{doc.reference_code}</Badge>
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${statusInfo.cls}`}>
              <statusInfo.Icon className="h-3 w-3" />
              {statusInfo.label}
            </span>
          </div>
          <h3 className="truncate font-medium text-foreground">{doc.title}</h3>
          {doc.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{doc.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {doc.sender && <span>{t("sender")}: <span className="text-foreground">{doc.sender}</span></span>}
            {doc.recipient && <span>{t("recipient")}: <span className="text-foreground">{doc.recipient}</span></span>}
            {doc.outgoing_folder && <span>{t("folder")}: <span className="text-foreground">{doc.outgoing_folder === "technical" ? t("technical") : t("administration")}</span></span>}
            <span>{t("date")}: {format(new Date(doc.document_date), "dd MMM yyyy", { locale })}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {doc.file_path && (
            <Button variant="outline" size="sm" onClick={open}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              {t("open")}
            </Button>
          )}
          {isSecretary && doc.status === "pending" && (
            <Button variant="outline" size="sm" onClick={() => updateStatus("processed")}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {t("markProcessed")}
            </Button>
          )}
          {isSecretary && doc.status !== "archived" && (
            <Button variant="ghost" size="sm" onClick={() => updateStatus("archived")}>
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              {t("markArchived")}
            </Button>
          )}
          {showPostpone && doc.status === "pending" && (
            <Button variant="ghost" size="sm" onClick={() => toast.success(lang === "fr" ? "Document reporté" : "Document postponed")}>
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              {lang === "fr" ? "Plus tard" : "Later"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
