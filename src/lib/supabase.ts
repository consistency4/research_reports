import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Article = {
  id: string;
  title: string | null;
  authors: string[] | null;
  journal: string | null;
  doi: string | null;
  abstract: string | null;
  status: string;
  created_at: string;
};

export type Insight = {
  id: string;
  article_id: string;
  insight_type: string;
  title: string;
  content: string;
  evidence_quote: string | null;
  confidence: number | null;
  tags: string[];
  created_at: string;
};

export type SynthesisIdea = {
  id: string;
  title: string;
  description: string;
  novelty_score: number | null;
  created_at: string;
};

export type BusinessAlignment = {
  id: string;
  insight_id: string | null;
  article_id: string | null;
  alignment_type: "similarity" | "contrast" | "opportunity";
  title: string;
  description: string;
  business_theme: string | null;
  relevance_score: number | null;
  created_at: string;
};
