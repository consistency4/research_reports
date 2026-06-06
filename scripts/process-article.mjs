import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { chunkText, needsChunking } from "./lib/chunking.mjs";
import { dedupeInsights } from "./lib/dedupe-insights.mjs";

const InsightSchema = z.object({
  insights: z.array(
    z.object({
      insight_type: z.enum([
        "treatment_application",
        "clinical_outcome",
        "ai_method",
        "patient_population",
        "limitation",
        "future_direction",
        "implementation_barrier",
        "key_finding",
      ]),
      title: z.string(),
      content: z.string(),
      evidence_quote: z.string().optional(),
      confidence: z.number().min(0).max(1),
      tags: z.array(z.string()),
    }),
  ),
  article: z.object({
    title: z.string().optional(),
    authors: z.array(z.string()).optional(),
    journal: z.string().optional(),
    doi: z.string().optional(),
    abstract: z.string().optional(),
  }),
});

const BASE_EXTRACTION_PROMPT = `You are a medical research analyst specializing in AI applications in healthcare.

Extract structured insights from research about AI in medical treatments/diagnostics.

Focus on:
- How AI is applied clinically
- Methods and models used
- Patient populations studied
- Clinical outcomes and accuracy metrics
- Limitations and barriers
- Future research directions
- Novel findings worth tracking in a knowledge base

Return ONLY valid JSON matching this schema:
{
  "article": { "title": "...", "authors": ["..."], "journal": "...", "doi": "...", "abstract": "..." },
  "insights": [
    {
      "insight_type": "ai_method|clinical_outcome|treatment_application|patient_population|limitation|future_direction|implementation_barrier|key_finding",
      "title": "...",
      "content": "...",
      "evidence_quote": "...",
      "confidence": 0.0-1.0,
      "tags": ["..."]
    }
  ]
}

Be specific and cite evidence from the text where possible.`;

const CONSOLIDATE_PROMPT = `You are consolidating insights extracted from multiple sections of the same document.

Merge duplicates, combine overlapping points, and keep the strongest version of each unique insight.
Remove near-duplicates. Preserve distinct findings.

Return ONLY valid JSON:
{"insights": [{ "insight_type": "...", "title": "...", "content": "...", "evidence_quote": "...", "confidence": 0.0-1.0, "tags": ["..."] }]}`;

async function extractText(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const text = result.pages.map((p) => p.text).join("\n\n");
  await parser.destroy();
  return { text, pages: result.total };
}

function parseJsonResponse(raw, schema) {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return schema.parse(JSON.parse(cleaned));
}

function buildChunkPrompt(chunk) {
  const countGuidance = chunk.total === 1 ? "8-15" : "5-12";
  let prompt = `${BASE_EXTRACTION_PROMPT}\nExtract ${countGuidance} high-quality insights.`;

  if (chunk.total > 1) {
    prompt += `\n\nThis is section ${chunk.index + 1} of ${chunk.total} from a large document.
Extract insights from THIS SECTION ONLY — do not repeat insights likely covered in other sections.
For "article" metadata: only fill fields if clearly present in this section, otherwise use {}.`;
  }

  return prompt;
}

async function callClaude(anthropic, system, userContent) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: userContent }],
  });
  const raw = response.content.find((b) => b.type === "text")?.text;
  if (!raw) throw new Error("No response from Claude");
  return raw;
}

async function callOpenAI(openai, system, userContent) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");
  return raw;
}

async function extractFromChunk(llm, chunk) {
  const prompt = buildChunkPrompt(chunk);
  const userContent = `Section text:\n\n${chunk.text}`;
  const raw = llm.type === "claude"
    ? await callClaude(llm.client, prompt, userContent)
    : await callOpenAI(llm.client, prompt, userContent);
  return parseJsonResponse(raw, InsightSchema);
}

async function consolidateWithClaude(anthropic, insights) {
  if (insights.length <= 25) return dedupeInsights(insights);

  console.log(`  Consolidating ${insights.length} raw insights with Claude...`);
  const summary = insights.map(
    (i) => `- [${i.insight_type}] ${i.title}: ${i.content.slice(0, 200)}`,
  ).join("\n");

  const raw = await callClaude(
    anthropic,
    CONSOLIDATE_PROMPT,
    `Raw insights to consolidate:\n\n${summary}\n\nReturn the deduplicated list. Cap at ~40 unique insights.`,
  );

  const parsed = parseJsonResponse(
    raw,
    z.object({ insights: InsightSchema.shape.insights }),
  );
  return parsed.insights;
}

async function extractAllInsights(llm, text, anthropic) {
  const chunks = chunkText(text);
  const useChunks = needsChunking(text);

  if (useChunks) {
    console.log(`Large document — processing ${chunks.length} chunks...`);
  }

  let articleMeta = {};
  const allInsights = [];

  for (const chunk of chunks) {
    console.log(`  Chunk ${chunk.index + 1}/${chunk.total} (${chunk.text.length.toLocaleString()} chars)`);
    const result = await extractFromChunk(llm, chunk);

    if (chunk.index === 0 || result.article.title) {
      articleMeta = { ...articleMeta, ...result.article };
    }

    allInsights.push(...result.insights);
    console.log(`    → ${result.insights.length} insights`);

    if (chunk.index < chunks.length - 1) {
      await sleep(1500);
    }
  }

  let finalInsights = dedupeInsights(allInsights);
  console.log(`  ${allInsights.length} raw → ${finalInsights.length} after dedupe`);

  if (anthropic && finalInsights.length > 25) {
    finalInsights = await consolidateWithClaude(anthropic, finalInsights);
    console.log(`  → ${finalInsights.length} after Claude consolidation`);
  }

  return {
    article: {
      title: articleMeta.title ?? "Untitled",
      authors: articleMeta.authors,
      journal: articleMeta.journal,
      doi: articleMeta.doi,
      abstract: articleMeta.abstract,
    },
    insights: finalInsights,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const EMBEDDING_DIM = 384;

function textToEmbedding(text, dim = EMBEDDING_DIM) {
  const vec = new Float32Array(dim);
  const tokens = text.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) h = ((h << 5) - h + token.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % dim;
    const sign = h & 1 ? 1 : -1;
    vec[idx] += sign;
  }
  const norm = Math.sqrt([...vec].reduce((s, v) => s + v * v, 0)) || 1;
  return [...vec].map((v) => v / norm);
}

async function embedText(openai, text) {
  if (openai) {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  }
  return textToEmbedding(text);
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: node scripts/process-article.mjs <path-to-pdf>");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase env vars");
  if (!anthropicKey && !openaiKey) {
    throw new Error("Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
  const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
  const llm = anthropic
    ? { type: "claude", client: anthropic }
    : { type: "openai", client: openai };

  const filename = path.basename(pdfPath);
  console.log(`Processing: ${filename} (using ${llm.type})`);

  const { text, pages } = await extractText(pdfPath);
  console.log(`Extracted ${pages} pages (${text.length.toLocaleString()} chars)`);

  const { data: article, error: articleError } = await supabase
    .from("articles")
    .insert({
      file_path: filename,
      raw_text: text,
      status: "processing",
      metadata: { pages, char_count: text.length, chunked: needsChunking(text) },
    })
    .select()
    .single();

  if (articleError) throw articleError;
  console.log(`Created article: ${article.id}`);

  try {
    const storagePath = `${article.id}/${filename}`;
    const fileBuffer = fs.readFileSync(pdfPath);
    const { error: uploadError } = await supabase.storage
      .from("articles")
      .upload(storagePath, fileBuffer, { contentType: "application/pdf" });

    if (uploadError) {
      console.warn("Storage upload failed:", uploadError.message);
    } else {
      await supabase
        .from("articles")
        .update({ file_path: storagePath })
        .eq("id", article.id);
    }

    const extracted = await extractAllInsights(llm, text, anthropic);
    console.log(`Final: ${extracted.insights.length} insights`);

    await supabase
      .from("articles")
      .update({
        title: extracted.article.title,
        authors: extracted.article.authors,
        journal: extracted.article.journal,
        doi: extracted.article.doi,
        abstract: extracted.article.abstract,
      })
      .eq("id", article.id);

    for (const insight of extracted.insights) {
      const embeddingInput = `${insight.title}\n${insight.content}`;
      const embedding = await embedText(openai, embeddingInput);

      const { data: inserted, error: insightError } = await supabase
        .from("insights")
        .insert({
          article_id: article.id,
          insight_type: insight.insight_type,
          title: insight.title,
          content: insight.content,
          evidence_quote: insight.evidence_quote,
          confidence: insight.confidence,
          tags: insight.tags,
          embedding,
        })
        .select()
        .single();

      if (insightError) throw insightError;
      console.log(`  ✓ ${insight.insight_type}: ${insight.title}`);

      if (embedding?.length === EMBEDDING_DIM) {
        const { data: matches } = await supabase.rpc("match_insights", {
          query_embedding: embedding,
          match_threshold: 0.8,
          match_count: 5,
          exclude_article_id: article.id,
        });

        for (const match of matches ?? []) {
          if (match.id === inserted.id) continue;
          await supabase.from("insight_connections").upsert(
            {
              insight_a_id: inserted.id,
              insight_b_id: match.id,
              connection_type: "similar",
              description: `Semantic similarity: ${(match.similarity * 100).toFixed(1)}%`,
              strength: match.similarity,
            },
            { onConflict: "insight_a_id,insight_b_id,connection_type" },
          );
        }
      }
    }

    await supabase
      .from("articles")
      .update({ status: "complete" })
      .eq("id", article.id);

    if (anthropic) {
      console.log("\nRunning Shifu business relevance analysis...");
      execSync(`node scripts/analyze-business-relevance.mjs ${article.id}`, {
        stdio: "inherit",
        env: process.env,
      });
      console.log("\nRebuilding knowledge graph...");
      execSync(`node scripts/build-knowledge-graph.mjs`, {
        stdio: "inherit",
        env: process.env,
      });
      execSync(`node scripts/supplement-thesis-highlights.mjs`, {
        stdio: "inherit",
        env: process.env,
      });
    }

    console.log(`\nDone! Article ${article.id} processed successfully.`);
  } catch (err) {
    await supabase
      .from("articles")
      .update({ status: "error", error_message: String(err) })
      .eq("id", article.id);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
