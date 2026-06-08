import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { DocumentRowCard, type DocumentRow } from "@/components/DocumentRowCard";

export const Route = createFileRoute("/_app/pending")({
  component: PendingPage,
});

function PendingPage() {
  const { t } = useI18n();
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setDocs(data ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("pending")}</h1>
        <p className="text-sm text-muted-foreground">
          {filtered ? `${filtered.length} document${filtered.length !== 1 ? "s" : ""}` : t("loading")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        {!filtered && <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("loading")}</div>}
        {filtered && filtered.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
            {t("noDocuments")}
          </div>
        )}
        {filtered?.map((d) => <DocumentRowCard key={d.id} doc={d} onChanged={load} showPostpone />)}
      </div>
    </div>
  );
}
