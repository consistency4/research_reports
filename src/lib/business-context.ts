import fs from "fs";
import path from "path";

const CONTEXT_PATH = path.join(process.cwd(), "context", "shifu-health.md");

export function loadBusinessContext(): string {
  return fs.readFileSync(CONTEXT_PATH, "utf-8");
}

export type AlignmentType = "similarity" | "contrast" | "opportunity";

export type BusinessAlignment = {
  id: string;
  insight_id: string | null;
  article_id: string | null;
  alignment_type: AlignmentType;
  title: string;
  description: string;
  business_theme: string | null;
  relevance_score: number | null;
  created_at: string;
};
