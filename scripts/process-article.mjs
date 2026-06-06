import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { z } from "zod";

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
    title: z.string(),
    authors: z.array(z.string()).optional(),
    journal: z.string().optional(),
    doi: z.string().optional(),
    abstract: z.string().optional(),
  }),
});

const EXTRACTION_PROMPT = `You are a medical research analyst specializing in AI applications in healthcare.

Extract structured insights from this research article about AI in medical treatments/diagnostics.

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

Be specific and cite evidence from the text where possible. Extract 8-15 high-quality insights.`;

async function extractText(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const text = result.pages.map((p) => p.text).join("\n\n");
  await parser.destroy();
  return { text, pages: result.total };
}

function parseJsonResponse(raw) {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return InsightSchema.parse(JSON.parse(cleaned));
}

async function extractInsightsWithClaude(anthropic, text) {
  const truncated = text.slice(0, 100000);
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: EXTRACTION_PROMPT,
    messages: [
      {
        role: "user",
        content: `Article text:\n\n${truncated}`,
      },
    ],
  });

  const raw = response.content.find((block) => block.type === "text")?.text;
  if (!raw) throw new Error("No response from Claude");
  return parseJsonResponse(raw);
}

async function extractInsightsWithOpenAI(openai, text) {
  const truncated = text.slice(0, 100000);
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: `Article text:\n\n${truncated}` },
    ],
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");
  return parseJsonResponse(raw);
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

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase env vars");
  }
  if (!anthropicKey && !openaiKey) {
    throw new Error("Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
  const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
  const llm = anthropic ? "Claude" : "OpenAI";

  const filename = path.basename(pdfPath);
  console.log(`Processing: ${filename} (using ${llm})`);

  const { text, pages } = await extractText(pdfPath);
  console.log(`Extracted ${pages} pages (${text.length} chars)`);

  const { data: article, error: articleError } = await supabase
    .from("articles")
    .insert({
      file_path: filename,
      raw_text: text,
      status: "processing",
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

    const extracted = anthropic
      ? await extractInsightsWithClaude(anthropic, text)
      : await extractInsightsWithOpenAI(openai, text);
    console.log(`Extracted ${extracted.insights.length} insights`);

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
