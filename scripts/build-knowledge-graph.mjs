import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { kmeans } from "ml-kmeans";
import { parseEmbedding, textToEmbedding } from "./lib/embeddings.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_PATH = path.join(__dirname, "..", "context", "shifu-health.md");

const CLUSTER_COLORS = [
  "#6366f1", "#3b82f6", "#14b8a6", "#22c55e", "#f59e0b",
  "#f97316", "#ef4444", "#a855f7", "#ec4899", "#06b6d4",
  "#84cc16", "#8b5cf6",
];

const VALID_CATEGORIES = new Set(["clinical", "technical", "regulatory", "wellness", "ai_method", "general"]);
const VALID_IMPORTANCE = new Set(["core", "supporting", "reference"]);

function parseKnowledge(raw) {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  const data = JSON.parse(cleaned);

  const definitions = (data.definitions ?? [])
    .filter((d) => d?.term && d?.definition)
    .map((d) => ({
      term: String(d.term),
      definition: String(d.definition),
      category: VALID_CATEGORIES.has(d.category) ? d.category : "general",
      importance: VALID_IMPORTANCE.has(d.importance) ? d.importance : "supporting",
      related_terms: Array.isArray(d.related_terms) ? d.related_terms.map(String) : [],
      example_usage: d.example_usage ? String(d.example_usage) : undefined,
    }));

  const clusters = (data.clusters ?? [])
    .filter((c) => c?.label && Array.isArray(c.keywords))
    .map((c) => ({
      cluster_index: Number(c.cluster_index ?? 0),
      label: String(c.label),
      keywords: c.keywords.map(String).slice(0, 6),
      description: String(c.description ?? ""),
      shifu_relevance: Math.min(1, Math.max(0, Number(c.shifu_relevance ?? 0.5))),
    }));

  const normalizeHighlight = (h) => ({
    title: String(h.title ?? h.name ?? ""),
    description: String(h.description ?? h.summary ?? h.why_explore ?? ""),
    article_title: h.article_title ? String(h.article_title) : undefined,
    insight_title: h.insight_title ? String(h.insight_title) : undefined,
    business_theme: h.business_theme ? String(h.business_theme) : h.why_explore ? String(h.why_explore) : undefined,
    relevance_score: Number(h.relevance_score ?? 0.5),
    why_explore: h.why_explore ? String(h.why_explore) : undefined,
  });

  const thesis = data.thesis_highlights ?? {};
  const key_points = (thesis.key_points ?? []).map(normalizeHighlight).filter((h) => h.title);
  const limitations = (thesis.limitations ?? []).map(normalizeHighlight).filter((h) => h.title);
  const papers_to_explore = (thesis.papers_to_explore ?? []).map(normalizeHighlight).filter((h) => h.title);

  return { definitions, clusters, thesis_highlights: { key_points, limitations, papers_to_explore } };
}

function pcaReduce(vectors, dims = 3) {
  const n = vectors.length;
  const d = vectors[0].length;
  const mean = new Array(d).fill(0);
  for (const v of vectors) for (let i = 0; i < d; i++) mean[i] += v[i];
  for (let i = 0; i < d; i++) mean[i] /= n;

  const centered = vectors.map((v) => v.map((x, i) => x - mean[i]));
  const components = [];
  let data = centered.map((r) => [...r]);

  for (let c = 0; c < dims; c++) {
    let vec = data[0].map(() => Math.random() - 0.5);
    let norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
    vec = vec.map((x) => x / norm);

    for (let iter = 0; iter < 20; iter++) {
      const projection = data.map((row) => row.reduce((s, x, i) => s + x * vec[i], 0));
      const newVec = new Array(d).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < d; j++) newVec[j] += projection[i] * data[i][j];
      }
      norm = Math.sqrt(newVec.reduce((s, x) => s + x * x, 0)) || 1;
      vec = newVec.map((x) => x / norm);
    }

    components.push(vec);
    for (let i = 0; i < n; i++) {
      const dot = data[i].reduce((s, x, j) => s + x * vec[j], 0);
      for (let j = 0; j < d; j++) data[i][j] -= dot * vec[j];
    }
  }

  return centered.map((row) =>
    components.map((comp) => row.reduce((s, x, i) => s + x * comp[i], 0)),
  );
}

function normalizeCoords(coords, scale = 6) {
  const dims = coords[0].length;
  const mins = new Array(dims).fill(Infinity);
  const maxs = new Array(dims).fill(-Infinity);
  for (const c of coords) {
    for (let d = 0; d < dims; d++) {
      mins[d] = Math.min(mins[d], c[d]);
      maxs[d] = Math.max(maxs[d], c[d]);
    }
  }
  return coords.map((c) =>
    c.map((v, d) => {
      const range = maxs[d] - mins[d] || 1;
      return ((v - (mins[d] + maxs[d]) / 2) / range) * scale;
    }),
  );
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase env vars");
  if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const businessContext = fs.readFileSync(CONTEXT_PATH, "utf-8");

  const { data: insights, error: insErr } = await supabase
    .from("insights")
    .select("id, article_id, title, content, insight_type, tags, embedding");
  if (insErr) throw insErr;

  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, journal, doi");

  const articleMap = new Map((articles ?? []).map((a) => [a.id, a]));
  const k = Math.min(10, Math.max(4, Math.floor(insights.length / 6)));
  console.log(`Clustering ${insights.length} insights into ${k} topics...`);

  const vectors = insights.map((i) => {
    const emb = parseEmbedding(i.embedding);
    return emb ?? textToEmbedding(`${i.title}\n${i.content}`);
  });

  const { clusters: kmeansResult } = kmeans(vectors, k, { initialization: "kmeans++" });

  const clusterGroups = Array.from({ length: k }, () => []);
  kmeansResult.forEach((clusterIdx, i) => {
    clusterGroups[clusterIdx].push({ insight: insights[i], vector: vectors[i] });
  });

  const insightSummary = insights
    .map(
      (i) =>
        `[${i.insight_type}] ${i.title} (article: ${articleMap.get(i.article_id)?.title ?? "unknown"})\n${i.content.slice(0, 300)}`,
    )
    .join("\n\n");

  const clusterPreview = clusterGroups
    .map((group, idx) => {
      const titles = group.map((g) => g.insight.title).join("; ");
      const tags = [...new Set(group.flatMap((g) => g.insight.tags ?? []))].slice(0, 8);
      return `Cluster ${idx}: ${group.length} insights — ${titles}\nTags: ${tags.join(", ")}`;
    })
    .join("\n\n");

  console.log("Generating definitions, cluster labels, and thesis highlights with Claude...");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 12000,
    messages: [
      {
        role: "user",
        content: `You are building a research knowledge graph for Shifu Health.

## Shifu Business Context
${businessContext}

## Pre-computed Topic Clusters (from embedding analysis)
${clusterPreview}

## All Research Insights
${insightSummary}

## Articles in library
${(articles ?? []).map((a) => `- ${a.title} (${a.journal ?? "unknown"})`).join("\n")}

Generate:
1. **definitions** (20-30 terms): A study library of key concepts from this research that Shifu team should understand. Include clinical AI terms, wellness-adjacent concepts, and regulatory boundaries. Mark importance as core/supporting/reference.

2. **clusters** (one per cluster_index 0 to ${k - 1}): Short 2-4 word label, 3-6 repeating keywords that characterize the cluster, description, and shifu_relevance score (0-1) for how relevant this topic cluster is to Shifu's thesis.

3. **thesis_highlights**:
   - key_points: 8-12 insights most valuable for Shifu's strategy
   - limitations: 6-10 research limitations that inform Shifu's boundaries or risks
   - papers_to_explore: rank articles by exploration value for Shifu (include all articles with why)

Return ONLY valid JSON:
{
  "definitions": [...],
  "clusters": [...],
  "thesis_highlights": {
    "key_points": [...],
    "limitations": [...],
    "papers_to_explore": [...]
  }
}`,
      },
    ],
  });

  const raw = response.content.find((b) => b.type === "text")?.text;
  if (!raw) throw new Error("No Claude response");

  const knowledge = parseKnowledge(raw);

  console.log("Clearing existing knowledge graph...");
  await supabase.from("cluster_insights").delete().neq("cluster_id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("thesis_highlights").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("topic_clusters").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("definitions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const titleToInsight = new Map(insights.map((i) => [i.title, i]));
  const titleToArticle = new Map((articles ?? []).map((a) => [a.title, a]));

  console.log(`Storing ${knowledge.definitions.length} definitions...`);
  for (const def of knowledge.definitions) {
    const relatedInsightIds = insights
      .filter(
        (i) =>
          i.content.toLowerCase().includes(def.term.toLowerCase()) ||
          i.title.toLowerCase().includes(def.term.toLowerCase()),
      )
      .map((i) => i.id)
      .slice(0, 5);

    await supabase.from("definitions").insert({
      term: def.term,
      definition: def.definition,
      category: def.category,
      importance: def.importance,
      related_terms: def.related_terms,
      source_insight_ids: relatedInsightIds,
      example_usage: def.example_usage,
    });
    console.log(`  ✓ ${def.term}`);
  }

  const clusterCentroids = clusterGroups.map((group) => {
    const dim = group[0].vector.length;
    const centroid = new Array(dim).fill(0);
    for (const { vector } of group) {
      for (let i = 0; i < dim; i++) centroid[i] += vector[i];
    }
    return centroid.map((v) => v / group.length);
  });

  const positions3d = normalizeCoords(pcaReduce(clusterCentroids, 3));
  const clusterIdMap = new Map();

  console.log(`Storing ${k} topic clusters...`);
  for (const clusterMeta of knowledge.clusters) {
    const idx = clusterMeta.cluster_index;
    const group = clusterGroups[idx];
    if (!group?.length) continue;

    const pos = positions3d[idx] ?? [0, 0, 0];
    const articleIds = new Set(group.map((g) => g.insight.article_id));

    const { data: clusterRow, error } = await supabase
      .from("topic_clusters")
      .insert({
        label: clusterMeta.label,
        keywords: clusterMeta.keywords,
        description: clusterMeta.description,
        position_x: pos[0],
        position_y: pos[1],
        position_z: pos[2],
        position_w: clusterMeta.shifu_relevance,
        color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
        insight_count: group.length,
        article_count: articleIds.size,
      })
      .select()
      .single();

    if (error) throw error;
    clusterIdMap.set(idx, clusterRow.id);

    for (const { insight } of group) {
      await supabase.from("cluster_insights").insert({
        cluster_id: clusterRow.id,
        insight_id: insight.id,
        relevance_score: 1.0,
      });
    }
    console.log(`  ✓ [${idx}] ${clusterMeta.label} — ${clusterMeta.keywords.join(", ")}`);
  }

  const storeHighlights = async (items, type) => {
    for (const item of items) {
      const insight = item.insight_title ? titleToInsight.get(item.insight_title) : null;
      const article = item.article_title
        ? titleToArticle.get(item.article_title)
        : insight
          ? articleMap.get(insight.article_id)
          : null;

      let clusterId = null;
      if (insight) {
        for (const [idx, group] of clusterGroups.entries()) {
          if (group.some((g) => g.insight.id === insight.id)) {
            clusterId = clusterIdMap.get(idx);
            break;
          }
        }
      }

      await supabase.from("thesis_highlights").insert({
        highlight_type: type,
        title: item.title,
        description: item.description ?? item.why_explore ?? item.title,
        article_id: article?.id ?? null,
        insight_ids: insight ? [insight.id] : [],
        cluster_id: clusterId,
        relevance_score: item.relevance_score ?? 0.5,
        business_theme: item.business_theme ?? item.why_explore ?? null,
      });
    }
  };

  console.log("Storing thesis highlights...");
  await storeHighlights(knowledge.thesis_highlights.key_points, "key_point");
  await storeHighlights(knowledge.thesis_highlights.limitations, "limitation");
  await storeHighlights(knowledge.thesis_highlights.papers_to_explore, "paper_to_explore");

  console.log(
    `\nDone! ${knowledge.definitions.length} definitions, ${k} clusters, ${
      knowledge.thesis_highlights.key_points.length +
      knowledge.thesis_highlights.limitations.length +
      knowledge.thesis_highlights.papers_to_explore.length
    } thesis highlights.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
