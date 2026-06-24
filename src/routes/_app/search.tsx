import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search as SearchIcon, FileText, BookOpen, Users, Clock, CheckCircle2, Archive, TrendingUp, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_app/search")({
  component: SearchPage,
});

type Scope = "all" | "incoming" | "outgoing" | "legal";
type StatusFilter = "any" | "pending" | "processed" | "archived";

interface DocResult {
  id: string;
  reference_code: string;
  title: string;
  description: string | null;
  sender: string | null;
  recipient: string | null;
  type: "incoming" | "outgoing";
  status: string;
  category_main: string;
  category_sub: string;
  document_date: string;
}

interface LegalResult {
  id: string;
  reference: string | null;
  title: string;
  description: string | null;
  category: string | null;
  publication_date: string | null;
}

function toTsQuery(input: string): string {
  // Build a prefix tsquery: word1:* & word2:*
  return input
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length > 0)
    .map((w) => `${w}:*`)
    .join(" & ");
}

function highlight(text: string | null | undefined, q: string): React.ReactNode {
  if (!text) return null;
  const terms = q
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (terms.length === 0) return text;
  const re = new RegExp(`(${terms.join("|")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="rounded bg-[var(--primary-glow)]/30 px-0.5 text-foreground">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function SearchPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState<StatusFilter>("any");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<DocResult[]>([]);
  const [legal, setLegal] = useState<LegalResult[]>([]);

  const tsq = useMemo(() => toTsQuery(q), [q]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setDocs([]);
      setLegal([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const ilike = `%${q.trim()}%`;
        if (scope !== "legal") {
          let query = supabase
            .from("documents")
            .select(
              "id,reference_code,title,description,sender,recipient,type,status,category_main,category_sub,document_date",
            )
            .order("document_date", { ascending: false })
            .limit(50);

          if (tsq) {
            query = query.textSearch("search_vector", tsq, { config: "french" });
          } else {
            query = query.or(
              `title.ilike.${ilike},reference_code.ilike.${ilike},sender.ilike.${ilike},recipient.ilike.${ilike},description.ilike.${ilike}`,
            );
          }
          if (scope === "incoming" || scope === "outgoing") {
            query = query.eq("type", scope);
          }
          if (status !== "any") {
            query = query.eq("status", status);
          }
          if (from) query = query.gte("document_date", from);
          if (to) query = query.lte("document_date", to);

          const { data, error } = await query;
          if (error) throw error;
          setDocs((data ?? []) as DocResult[]);
        } else {
          setDocs([]);
        }

        if (scope === "all" || scope === "legal") {
          let lq = supabase
            .from("legal_texts")
            .select("id,reference,title,description,category,publication_date")
            .order("publication_date", { ascending: false, nullsFirst: false })
            .limit(50);
          if (tsq) {
            lq = lq.textSearch("search_vector", tsq, { config: "french" });
          } else {
            lq = lq.or(`title.ilike.${ilike},description.ilike.${ilike},reference.ilike.${ilike}`);
          }
          const { data, error } = await lq;
          if (error) throw error;
          setLegal((data ?? []) as LegalResult[]);
        } else {
          setLegal([]);
        }
      } catch (e) {
        console.error("search error", e);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [q, scope, status, from, to, tsq]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("searchTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("searchHint")}</p>
      </div>

      <Card className="space-y-4 p-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("searchAll")}</SelectItem>
              <SelectItem value="incoming">{t("searchIncoming")}</SelectItem>
              <SelectItem value="outgoing">{t("searchOutgoing")}</SelectItem>
              <SelectItem value="legal">{t("searchLegal")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("searchAnyStatus")}</SelectItem>
              <SelectItem value="pending">{t("statusPending")}</SelectItem>
              <SelectItem value="processed">{t("statusProcessed")}</SelectItem>
              <SelectItem value="archived">{t("statusArchived")}</SelectItem>
            </SelectContent>
          </Select>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("searchFrom")}</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("searchTo")}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {(from || to || status !== "any" || scope !== "all") && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom("");
                setTo("");
                setStatus("any");
                setScope("all");
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("searchResults")} · {docs.length + legal.length}
          </h2>
          {loading && <span className="text-xs text-muted-foreground">{t("loading")}</span>}
        </div>

        {q.trim().length >= 2 && !loading && docs.length === 0 && legal.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">{t("searchNoResults")}</Card>
        )}

        {docs.map((d) => (
          <Link
            key={d.id}
            to={d.type === "incoming" ? "/incoming" : "/outgoing"}
            className="block"
          >
            <Card className="p-4 transition-colors hover:bg-accent/40">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{highlight(d.title, q)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {d.reference_code}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {d.type === "incoming" ? t("searchIncoming") : t("searchOutgoing")}
                    </Badge>
                    <Badge className="text-[10px]">{d.status}</Badge>
                  </div>
                  {d.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {highlight(d.description, q)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.type === "incoming" ? t("sender") : t("recipient")}:{" "}
                    {highlight(d.type === "incoming" ? d.sender : d.recipient, q) || "—"} ·{" "}
                    {d.category_main}/{d.category_sub} · {d.document_date}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}

        {legal.map((l) => (
          <Link key={l.id} to="/legal" className="block">
            <Card className="p-4 transition-colors hover:bg-accent/40">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{highlight(l.title, q)}</span>
                    {l.reference && (
                      <Badge variant="outline" className="text-[10px]">
                        {l.reference}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {t("searchLegal")}
                    </Badge>
                  </div>
                  {l.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {highlight(l.description, q)}
                    </p>
                  )}
                  {(l.category || l.publication_date) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {l.category || ""}
                      {l.category && l.publication_date ? " · " : ""}
                      {l.publication_date || ""}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
