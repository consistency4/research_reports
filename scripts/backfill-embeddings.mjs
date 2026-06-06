import { createClient } from "@supabase/supabase-js";

const DIM = 384;

function textToEmbedding(text) {
  const vec = new Float32Array(DIM);
  const tokens = text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);

  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) {
      h = ((h << 5) - h + token.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(h) % DIM;
    const sign = h & 1 ? 1 : -1;
    vec[idx] += sign;
  }

  const norm = Math.sqrt([...vec].reduce((s, v) => s + v * v, 0)) || 1;
  return [...vec].map((v) => v / norm);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const { data: insights, error } = await supabase
  .from("insights")
  .select("id, title, content, embedding")
  .is("embedding", null);

if (error) throw error;

console.log(`Backfilling ${insights?.length ?? 0} insights...`);

for (const insight of insights ?? []) {
  const embedding = textToEmbedding(`${insight.title}\n${insight.content}`);
  const { error: updateError } = await supabase
    .from("insights")
    .update({ embedding })
    .eq("id", insight.id);

  if (updateError) throw updateError;
  console.log(`  ✓ ${insight.title}`);
}

console.log("Done.");
