import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatBody = { messages?: unknown; role?: string; lang?: string };

function getUserSupabase(token: string | null) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages)) {
          return new Response("messages required", { status: 400 });
        }
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace(/^Bearer\s+/i, "") ?? null;
        const sb = getUserSupabase(token);

        const role = body.role === "director" ? "director" : "secretary";
        const lang = body.lang === "en" ? "en" : "fr";
        const today = new Date().toISOString().slice(0, 10);

        const systemFr = `Tu es l'assistant intelligent du Secrétariat de Direction (SAEMAPE). Rôle utilisateur: ${role === "director" ? "Directeur" : "Secrétaire"}. Date du jour: ${today}.

Tu aides à : (1) rechercher des courriers en langage naturel, (2) résumer/classer des documents, (3) générer rapports & analyses, (4) consulter la bibliothèque juridique, (5) productivité (rappels, suggestions, briefings).

Règles :
- Réponds toujours en français sauf si l'utilisateur écrit en anglais.
- Utilise les outils pour interroger la base avant d'inventer un fait.
- Sois concis, structuré (listes, titres courts). Cite les codes de référence des documents quand pertinent.
- Pour le Directeur: fournis briefings, synthèses, alertes. Ne propose pas d'actions CRUD.
- Pour la Secrétaire: propose des actions concrètes et raccourcis.`;

        const systemEn = systemFr.replace("Réponds toujours en français sauf si l'utilisateur écrit en anglais.", "Always reply in English unless the user writes in French.");

        const gateway = createLovableAiGatewayProvider(apiKey);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: lang === "en" ? systemEn : systemFr,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
          stopWhen: stepCountIs(50),
          tools: {
            search_documents: tool({
              description: "Recherche de courriers (incoming/outgoing) par mots-clés, expéditeur, destinataire, statut ou date.",
              inputSchema: z.object({
                query: z.string().optional().describe("Mots-clés libres"),
                type: z.enum(["incoming", "outgoing", "any"]).default("any"),
                status: z.enum(["pending", "processed", "archived", "any"]).default("any"),
                from_date: z.string().optional().describe("YYYY-MM-DD"),
                to_date: z.string().optional().describe("YYYY-MM-DD"),
                limit: z.number().min(1).max(25).default(10),
              }),
              execute: async (args) => {
                let q = sb
                  .from("documents")
                  .select("id,reference_code,order_number,title,description,sender,recipient,type,status,document_date,created_at")
                  .order("created_at", { ascending: false })
                  .limit(args.limit);
                if (args.type !== "any") q = q.eq("type", args.type);
                if (args.status !== "any") q = q.eq("status", args.status);
                if (args.from_date) q = q.gte("document_date", args.from_date);
                if (args.to_date) q = q.lte("document_date", args.to_date);
                if (args.query) {
                  const like = `%${args.query}%`;
                  q = q.or(`title.ilike.${like},description.ilike.${like},sender.ilike.${like},recipient.ilike.${like},reference_code.ilike.${like}`);
                }
                const { data, error } = await q;
                if (error) return { error: error.message };
                return { count: data?.length ?? 0, results: data ?? [] };
              },
            }),
            get_document: tool({
              description: "Récupère un courrier par code de référence (ex: IN-2026-00012/SAE).",
              inputSchema: z.object({ reference_code: z.string() }),
              execute: async ({ reference_code }) => {
                const { data, error } = await sb
                  .from("documents")
                  .select("*")
                  .eq("reference_code", reference_code)
                  .maybeSingle();
                if (error) return { error: error.message };
                return data ?? { error: "not_found" };
              },
            }),
            get_stats: tool({
              description: "Statistiques agrégées des courriers (par défaut: aujourd'hui).",
              inputSchema: z.object({
                from_date: z.string().optional(),
                to_date: z.string().optional(),
              }),
              execute: async ({ from_date, to_date }) => {
                const start = from_date ?? today;
                const end = to_date ?? today;
                const base = sb.from("documents").select("type,status", { count: "exact" }).gte("document_date", start).lte("document_date", end);
                const { data, error } = await base;
                if (error) return { error: error.message };
                const stats = {
                  total: data.length,
                  incoming: data.filter((d) => d.type === "incoming").length,
                  outgoing: data.filter((d) => d.type === "outgoing").length,
                  pending: data.filter((d) => d.status === "pending").length,
                  processed: data.filter((d) => d.status === "processed").length,
                  archived: data.filter((d) => d.status === "archived").length,
                  range: { start, end },
                };
                return stats;
              },
            }),
            get_pending: tool({
              description: "Liste les courriers en attente de traitement (priorité aux plus anciens).",
              inputSchema: z.object({ limit: z.number().min(1).max(50).default(15) }),
              execute: async ({ limit }) => {
                const { data, error } = await sb
                  .from("documents")
                  .select("reference_code,title,sender,recipient,type,document_date,created_at")
                  .eq("status", "pending")
                  .order("document_date", { ascending: true })
                  .limit(limit);
                if (error) return { error: error.message };
                return { count: data?.length ?? 0, results: data ?? [] };
              },
            }),
            search_legal: tool({
              description: "Recherche dans la bibliothèque juridique (lois, décrets, arrêtés, notes techniques).",
              inputSchema: z.object({
                query: z.string().optional(),
                text_type: z.string().optional().describe("Constitution, Loi, Ordonnance, Décret, Arrêté, Circulaire, Note technique, Avis technique"),
                limit: z.number().min(1).max(20).default(10),
              }),
              execute: async (args) => {
                let q = sb
                  .from("legal_texts")
                  .select("id,title,reference,text_type,summary,source_url,published_at")
                  .order("published_at", { ascending: false, nullsFirst: false })
                  .limit(args.limit);
                if (args.text_type) q = q.eq("text_type", args.text_type);
                if (args.query) {
                  const like = `%${args.query}%`;
                  q = q.or(`title.ilike.${like},reference.ilike.${like},summary.ilike.${like},content.ilike.${like}`);
                }
                const { data, error } = await q;
                if (error) return { error: error.message };
                return { count: data?.length ?? 0, results: data ?? [] };
              },
            }),
            get_legal_text: tool({
              description: "Récupère le contenu intégral d'un texte juridique (pour questions Q&R précises).",
              inputSchema: z.object({ id: z.string().uuid().optional(), reference: z.string().optional() }),
              execute: async ({ id, reference }) => {
                let q = sb.from("legal_texts").select("*").limit(1);
                if (id) q = q.eq("id", id);
                else if (reference) q = q.eq("reference", reference);
                else return { error: "id_or_reference_required" };
                const { data, error } = await q.maybeSingle();
                if (error) return { error: error.message };
                return data ?? { error: "not_found" };
              },
            }),
            daily_briefing: tool({
              description: "Génère un briefing du jour: nouveaux courriers, en attente, traités, tâches.",
              inputSchema: z.object({ date: z.string().optional() }),
              execute: async ({ date }) => {
                const d = date ?? today;
                const [docs, tasks] = await Promise.all([
                  sb.from("documents").select("reference_code,title,type,status,sender,recipient,document_date").or(`document_date.eq.${d},created_at.gte.${d}T00:00:00`).limit(100),
                  sb.from("other_tasks").select("detail,observation").eq("task_date", d).limit(50),
                ]);
                return {
                  date: d,
                  documents: docs.data ?? [],
                  other_tasks: tasks.data ?? [],
                };
              },
            }),
            get_recent_activity: tool({
              description: "Dernières activités du journal d'audit.",
              inputSchema: z.object({ limit: z.number().min(1).max(50).default(20) }),
              execute: async ({ limit }) => {
                const { data, error } = await sb
                  .from("activity_log")
                  .select("action,entity_type,details,created_at")
                  .order("created_at", { ascending: false })
                  .limit(limit);
                if (error) return { error: error.message };
                return { count: data?.length ?? 0, results: data ?? [] };
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});
