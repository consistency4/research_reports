import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseEmbedding, textToEmbedding } from "@/lib/embeddings";
import { reduceTo3D } from "@/lib/pca";

const TYPE_COLORS: Record<string, string> = {
  treatment_application: "#3b82f6",
  clinical_outcome: "#22c55e",
  ai_method: "#a855f7",
  patient_population: "#f59e0b",
  limitation: "#ef4444",
  future_direction: "#14b8a6",
  implementation_barrier: "#f97316",
  key_finding: "#6366f1",
};

export async function GET() {
  try {
  const [insightsRes, connectionsRes, articlesRes] = await Promise.all([
    supabase.from("insights").select("*").order("created_at"),
    supabase.from("insight_connections").select("*"),
    supabase.from("articles").select("id, title, journal"),
  ]);

  if (insightsRes.error) {
    return NextResponse.json({ error: insightsRes.error.message }, { status: 500 });
  }

  const insights = insightsRes.data ?? [];

  if (insights.length === 0) {
    return NextResponse.json({ nodes: [], links: [], articles: [] });
  }

  const vectors = insights.map((i) => {
    const stored = parseEmbedding(i.embedding);
    if (stored) return stored;
    return textToEmbedding(`${i.title}\n${i.content}`);
  });

  const positions = reduceTo3D(vectors);

  const nodes = insights.map((insight, idx) => ({
    id: insight.id,
    articleId: insight.article_id,
    title: insight.title,
    content: insight.content,
    type: insight.insight_type,
    color: TYPE_COLORS[insight.insight_type] ?? "#78716c",
    confidence: insight.confidence,
    tags: insight.tags ?? [],
    evidenceQuote: insight.evidence_quote,
    position: positions[idx],
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links = (connectionsRes.data ?? [])
    .filter(
      (c) => nodeIds.has(c.insight_a_id) && nodeIds.has(c.insight_b_id),
    )
    .map((c) => ({
      source: c.insight_a_id,
      target: c.insight_b_id,
      type: c.connection_type,
      strength: c.strength,
      description: c.description,
    }));

  return NextResponse.json({
    nodes,
    links,
    articles: articlesRes.data ?? [],
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build insight map";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
