import { loadBusinessContext } from "@/lib/business-context";
import { textToEmbedding } from "@/lib/embeddings";
import { supabase } from "@/lib/supabase";

const NO_EXCLUDE = "00000000-0000-0000-0000-000000000000";

type MatchedInsight = {
  id: string;
  article_id: string;
  title: string;
  content: string;
  insight_type: string;
  evidence_quote: string | null;
  similarity: number;
};

export async function buildChatContext(query: string, clusterId?: string) {
  const businessContext = loadBusinessContext();

  const [definitionsRes, articlesRes, alignmentsRes, clustersRes] = await Promise.all([
    supabase
      .from("definitions")
      .select("term, definition, category, importance")
      .order("importance")
      .limit(20),
    supabase.from("articles").select("id, title, journal, doi, abstract"),
    supabase
      .from("business_alignments")
      .select("*")
      .order("relevance_score", { ascending: false })
      .limit(20),
    supabase.from("topic_clusters").select("*").order("position_w", { ascending: false }),
  ]);

  const articles = articlesRes.data ?? [];
  const articleMap = new Map(articles.map((a) => [a.id, a]));

  let insightIds: string[] = [];
  let clusterSection = "";

  if (clusterId) {
    const { data: cluster } = await supabase
      .from("topic_clusters")
      .select("*")
      .eq("id", clusterId)
      .single();

    const { data: links } = await supabase
      .from("cluster_insights")
      .select("insight_id")
      .eq("cluster_id", clusterId);

    insightIds = (links ?? []).map((l) => l.insight_id);

    clusterSection = `
## Active Topic Cluster: ${cluster?.label ?? "Unknown"}
Keywords: ${(cluster?.keywords ?? []).join(", ")}
Description: ${cluster?.description ?? ""}
Shifu relevance: ${((cluster?.position_w ?? 0) * 100).toFixed(0)}%`;
  }

  const queryEmbedding = textToEmbedding(query);
  const { data: semanticMatches } = await supabase.rpc("match_insights", {
    query_embedding: queryEmbedding,
    match_threshold: 0.45,
    match_count: 12,
    exclude_article_id: NO_EXCLUDE,
  });

  let relevantInsights: MatchedInsight[] = (semanticMatches ?? []) as MatchedInsight[];

  if (clusterId && insightIds.length) {
    const { data: clusterInsights } = await supabase
      .from("insights")
      .select("id, article_id, title, content, insight_type, evidence_quote")
      .in("id", insightIds);

    const clusterSet = new Set(relevantInsights.map((i) => i.id));
    for (const insight of clusterInsights ?? []) {
      if (!clusterSet.has(insight.id)) {
        relevantInsights.push({ ...insight, similarity: 0.5 });
      }
    }
  }

  if (relevantInsights.length === 0) {
    const { data: fallback } = await supabase
      .from("insights")
      .select("id, article_id, title, content, insight_type, evidence_quote")
      .order("created_at", { ascending: false })
      .limit(12);

    relevantInsights = (fallback ?? []).map((i) => ({ ...i, similarity: 0 }));
  }

  const relevantInsightIds = relevantInsights.map((i) => i.id);
  const relevantAlignments = (alignmentsRes.data ?? []).filter(
    (a) => a.insight_id && relevantInsightIds.includes(a.insight_id),
  );
  const topAlignments =
    relevantAlignments.length > 0
      ? relevantAlignments
      : (alignmentsRes.data ?? []).slice(0, 10);

  const definitionsContext = (definitionsRes.data ?? [])
    .map((d) => `**${d.term}** (${d.importance}): ${d.definition}`)
    .join("\n");

  const insightsContext = relevantInsights
    .map((i) => {
      const article = articleMap.get(i.article_id);
      const doi = article?.doi ? `https://doi.org/${article.doi}` : null;
      return `### ${i.title}
Type: ${i.insight_type}
Source: ${article?.title ?? "Unknown"}${doi ? ` (${doi})` : ""}
${i.content}${i.evidence_quote ? `\nEvidence: "${i.evidence_quote}"` : ""}`;
    })
    .join("\n\n");

  const alignmentsContext = topAlignments
    .map(
      (a) =>
        `[${a.alignment_type}] ${a.title}: ${a.description}${a.business_theme ? ` (theme: ${a.business_theme})` : ""}`,
    )
    .join("\n");

  const clustersContext = (clustersRes.data ?? [])
    .slice(0, 8)
    .map(
      (c) =>
        `- **${c.label}** (${((c.position_w ?? 0) * 100).toFixed(0)}% Shifu relevance): ${c.description}`,
    )
    .join("\n");

  const articlesContext = articles
    .map(
      (a) =>
        `- ${a.title ?? "Untitled"}${a.journal ? ` (${a.journal})` : ""}${a.doi ? ` — https://doi.org/${a.doi}` : ""}`,
    )
    .join("\n");

  return {
    businessContext,
    definitionsContext,
    clusterSection,
    insightsContext,
    alignmentsContext,
    clustersContext,
    articlesContext,
  };
}

export function buildChatSystemPrompt(context: Awaited<ReturnType<typeof buildChatContext>>) {
  return `You are a research analyst helping the Shifu Health team explore medical AI research in their knowledge base.

## Shifu Business Context
${context.businessContext}

## Definition Library
${context.definitionsContext}

## Topic Clusters
${context.clustersContext}
${context.clusterSection}

## Research Library (${context.articlesContext.split("\n").length} papers)
${context.articlesContext}

## Relevant Insights (retrieved for this query)
${context.insightsContext}

## Shifu Business Alignments
${context.alignmentsContext}

Instructions:
- Answer using the research knowledge base above and Shifu business context
- Cite specific papers by title and include DOI links when referencing findings
- Contrast research with Shifu's wellness-only positioning where relevant
- Flag limitations and risks that inform product decisions
- If the knowledge base lacks information to answer fully, say so clearly
- Use bullet points and clear headers for readability
- Be concise but substantive`;
}
