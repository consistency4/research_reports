import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const [clustersRes, insightsRes, articlesRes, definitionsRes, highlightsRes, clusterLinksRes] =
    await Promise.all([
      supabase.from("topic_clusters").select("*").order("position_w", { ascending: false }),
      supabase.from("insights").select("id, article_id, title, content, insight_type, tags, confidence"),
      supabase.from("articles").select("id, title, journal, doi, abstract"),
      supabase.from("definitions").select("*").order("importance"),
      supabase.from("thesis_highlights").select("*").order("relevance_score", { ascending: false }),
      supabase.from("cluster_insights").select("*"),
    ]);

  if (clustersRes.error) {
    return NextResponse.json({ error: clustersRes.error.message }, { status: 500 });
  }

  const insights = insightsRes.data ?? [];
  const articles = articlesRes.data ?? [];
  const clusterLinks = clusterLinksRes.data ?? [];
  const insightMap = new Map(insights.map((i) => [i.id, i]));
  const articleMap = new Map(articles.map((a) => [a.id, a]));

  const clusters = (clustersRes.data ?? []).map((cluster) => {
    const linkedInsightIds = clusterLinks
      .filter((l) => l.cluster_id === cluster.id)
      .map((l) => l.insight_id);

    const clusterInsights = linkedInsightIds
      .map((id) => insightMap.get(id))
      .filter(Boolean);

    const articleIds = [...new Set(clusterInsights.map((i) => i!.article_id))];
    const clusterArticles = articleIds.map((id) => articleMap.get(id)).filter(Boolean);

    return {
      id: cluster.id,
      label: cluster.label,
      keywords: cluster.keywords,
      description: cluster.description,
      position: {
        x: cluster.position_x,
        y: cluster.position_y,
        z: cluster.position_z,
        w: cluster.position_w,
      },
      color: cluster.color,
      insightCount: cluster.insight_count,
      articleCount: cluster.article_count,
      insights: clusterInsights,
      articles: clusterArticles,
    };
  });

  const highlights = {
    keyPoints: (highlightsRes.data ?? [])
      .filter((h) => h.highlight_type === "key_point")
      .map((h) => ({
        ...h,
        article: h.article_id ? articleMap.get(h.article_id) ?? null : null,
      })),
    limitations: (highlightsRes.data ?? [])
      .filter((h) => h.highlight_type === "limitation")
      .map((h) => ({
        ...h,
        article: h.article_id ? articleMap.get(h.article_id) ?? null : null,
      })),
    papersToExplore: (highlightsRes.data ?? [])
      .filter((h) => h.highlight_type === "paper_to_explore")
      .map((h) => ({
        ...h,
        article: h.article_id ? articleMap.get(h.article_id) ?? null : null,
      })),
  };

  return NextResponse.json({
    clusters,
    definitions: definitionsRes.data ?? [],
    highlights,
    articles,
  });
}
