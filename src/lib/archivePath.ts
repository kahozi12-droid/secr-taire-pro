// Build the archive relative path (year/month/group/sub/filename) for a document.

import type { Tables } from "@/integrations/supabase/types";
import {
  FOLDER_INCOMING,
  FOLDER_OUTGOING,
  monthFolderName,
  sanitizeCode,
} from "@/lib/scannerArchive";

type Doc = Tables<"documents">;

export function archiveRelativePath(doc: Doc): string {
  const d = new Date(doc.document_date);
  const year = d.getFullYear();
  const month = monthFolderName(d.getMonth());
  const group = doc.type === "incoming" ? FOLDER_INCOMING : FOLDER_OUTGOING;
  let sub: string;
  if (doc.type === "outgoing") {
    sub = doc.outgoing_folder === "technical"
      ? "Courriers_Techniques"
      : "Courriers_Administratifs";
  } else {
    sub = sanitizeCode(doc.category_sub);
  }
  const original = doc.file_name ?? `${doc.reference_code.replace(/[/\\]/g, "_")}.pdf`;
  // Prefix with reference code for chronological ordering & unicity.
  const safeRef = doc.reference_code.replace(/[/\\]/g, "_");
  const filename = original.startsWith(safeRef) ? original : `${safeRef}__${original}`;
  return `${year}/${month}/${group}/${sub}/${filename}`;
}

export function archiveYearForDoc(doc: Doc): number {
  return new Date(doc.document_date).getFullYear();
}
