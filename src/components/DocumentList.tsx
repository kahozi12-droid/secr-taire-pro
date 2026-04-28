import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/classification";
import { NewDocumentDialog } from "@/components/NewDocumentDialog";
import { DocumentRowCard, type DocumentRow } from "@/components/DocumentRowCard";

interface Props {
  type: "incoming" | "outgoing";
}

export function DocumentList({ type }: Props) {
  const { t } = useI18n();
  const { role } = useAuth();
  const isSecretary = role === "secretary";
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    let q = supabase.from("documents").select("*").eq("type", type).order("created_at", { ascending: false });
    if (catFilter !== "all") q = q.eq("category_main", catFilter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter as "pending" | "processed" | "archived");
    const { data } = await q;
    setDocs(data ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type, catFilter, statusFilter]);

  const filtered = useMemo(() => {
    if (!docs) return null;
    const s = search.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(s) ||
        d.reference_code.toLowerCase().includes(s) ||
        d.sender?.toLowerCase().includes(s) ||
        d.recipient?.toLowerCase().includes(s) ||
        d.category_sub.toLowerCase().includes(s),
    );
  }, [docs, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {type === "incoming" ? t("incoming") : t("outgoing")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered ? `${filtered.length} document${filtered.length !== 1 ? "s" : ""}` : t("loading")}
          </p>
        </div>
        {isSecretary && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {type === "incoming" ? t("newIncoming") : t("newOutgoing")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("status")}: {t("allCategories")}</SelectItem>
            <SelectItem value="pending">{t("statusPending")}</SelectItem>
            <SelectItem value="processed">{t("statusProcessed")}</SelectItem>
            <SelectItem value="archived">{t("statusArchived")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {!filtered && <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>}
        {filtered && filtered.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
            {t("noDocuments")}
          </div>
        )}
        {filtered?.map((d) => <DocumentRowCard key={d.id} doc={d} onChanged={load} />)}
      </div>

      {isSecretary && <NewDocumentDialog open={open} onOpenChange={setOpen} type={type} onCreated={load} />}
    </div>
  );
}
