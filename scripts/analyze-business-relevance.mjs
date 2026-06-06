import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_PATH = path.join(__dirname, "..", "context", "shifu-health.md");

const AlignmentSchema = z.object({
  alignments: z.array(
    z.object({
      insight_title: z.string(),
      alignment_type: z.enum(["similarity", "contrast", "opportunity"]),
      title: z.string(),
      description: z.string(),
      business_theme: z.string(),
      relevance_score: z.number().min(0).max(1),
    }),
  ),
});

const ANALYSIS_PROMPT = `You are a strategic research analyst for Shifu Health, an AI wellness coaching platform.

Compare research insights against the Shifu business context document. For each insight, identify:

- **similarity** — Research validates, supports, or parallels what Shifu is building
- **contrast** — Research diverges from Shifu's approach, market, or regulatory positioning (explain why it matters)
- **opportunity** — Research suggests a feature, capability, or strategic direction Shifu could adopt

Be specific. Reference both the research insight AND the relevant Shifu capability or boundary.
Generate 1-2 alignments per insight where genuinely relevant (skip weak matches).
Prioritize high-signal comparisons over generic observations.`;

const BATCH_SIZE = 12;

function loadContext() {
  return fs.readFileSync(CONTEXT_PATH, "utf-8");
}

function chunkArray(items, size) {
  const batches = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function analyzeBatch(anthropic, businessContext, insights) {
  const insightBlock = insights
    .map(
      (i) =>
        `### ${i.title}\nType: ${i.insight_type}\nTags: ${(i.tags ?? []).join(", ")}\n${i.content}`,
    )
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: ANALYSIS_PROMPT,
    messages: [
      {
        role: "user",
        content: `## Shifu Business Context\n\n${businessContext}\n\n## Research Insights\n\n${insightBlock}\n\nReturn ONLY valid JSON:\n{"alignments": [{"insight_title": "...", "alignment_type": "similarity|contrast|opportunity", "title": "...", "description": "...", "business_theme": "...", "relevance_score": 0.0-1.0}]}`,
      },
    ],
  });

  const raw = response.content.find((b) => b.type === "text")?.text;
  if (!raw) throw new Error("No response from Claude");

  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return AlignmentSchema.parse(JSON.parse(cleaned)).alignments;
}

async function main() {
  const articleId = process.argv[2];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase env vars");
  if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const businessContext = loadContext();

  let query = supabase.from("insights").select("id, article_id, title, content, insight_type, tags");
  if (articleId) query = query.eq("article_id", articleId);

  const { data: insights, error } = await query;
  if (error) throw error;
  if (!insights?.length) {
    console.log("No insights to analyze.");
    return;
  }

  const batches = chunkArray(insights, BATCH_SIZE);
  console.log(
    `Analyzing ${insights.length} insights in ${batches.length} batch(es)...`,
  );

  const allAlignments = [];
  for (let i = 0; i < batches.length; i++) {
    console.log(`  Batch ${i + 1}/${batches.length} (${batches[i].length} insights)`);
    const alignments = await analyzeBatch(anthropic, businessContext, batches[i]);
    allAlignments.push(...alignments);
    if (i < batches.length - 1) await sleep(1500);
  }

  const titleToInsight = new Map(insights.map((i) => [i.title, i]));

  if (articleId) {
    await supabase.from("business_alignments").delete().eq("article_id", articleId);
  } else {
    await supabase.from("business_alignments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  let inserted = 0;
  for (const alignment of allAlignments) {
    const insight = titleToInsight.get(alignment.insight_title);
    if (!insight) {
      console.warn(`  ? No match for insight: ${alignment.insight_title}`);
      continue;
    }

    const { error: insertError } = await supabase.from("business_alignments").insert({
      insight_id: insight.id,
      article_id: insight.article_id,
      alignment_type: alignment.alignment_type,
      title: alignment.title,
      description: alignment.description,
      business_theme: alignment.business_theme,
      relevance_score: alignment.relevance_score,
    });

    if (insertError) throw insertError;
    console.log(`  ✓ [${alignment.alignment_type}] ${alignment.title}`);
    inserted++;
  }

  console.log(`\nStored ${inserted} business alignments.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
