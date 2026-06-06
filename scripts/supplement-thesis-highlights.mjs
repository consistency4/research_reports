import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const { count } = await supabase
  .from("thesis_highlights")
  .select("*", { count: "exact", head: true });

if ((count ?? 0) >= 10) {
  console.log(`Already have ${count} highlights, skipping.`);
  process.exit(0);
}

const { data: alignments } = await supabase
  .from("business_alignments")
  .select("*")
  .order("relevance_score", { ascending: false })
  .limit(20);

const { data: limitationInsights } = await supabase
  .from("insights")
  .select("*")
  .in("insight_type", ["limitation", "implementation_barrier"])
  .limit(10);

const { data: articles } = await supabase.from("articles").select("id, title");

for (const a of alignments ?? []) {
  if (a.alignment_type === "similarity" || a.alignment_type === "opportunity") {
    await supabase.from("thesis_highlights").upsert(
      {
        highlight_type: "key_point",
        title: a.title,
        description: a.description,
        insight_ids: a.insight_id ? [a.insight_id] : [],
        relevance_score: a.relevance_score ?? 0.7,
        business_theme: a.business_theme,
      },
      { onConflict: "id", ignoreDuplicates: false },
    );
  }
}

for (const i of limitationInsights ?? []) {
  await supabase.from("thesis_highlights").insert({
    highlight_type: "limitation",
    title: i.title,
    description: i.content,
    article_id: i.article_id,
    insight_ids: [i.id],
    relevance_score: i.confidence ?? 0.7,
    business_theme: "research_limitation",
  });
}

for (const article of articles ?? []) {
  await supabase.from("thesis_highlights").insert({
    highlight_type: "paper_to_explore",
    title: article.title ?? "Untitled",
    description: `Explore this paper for Shifu-relevant AI in health insights.`,
    article_id: article.id,
    relevance_score: 0.8,
    business_theme: "paper_library",
  });
}

const { count: final } = await supabase
  .from("thesis_highlights")
  .select("*", { count: "exact", head: true });

console.log(`Thesis highlights now: ${final}`);
