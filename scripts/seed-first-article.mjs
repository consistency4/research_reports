import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";

const supabaseUrl = "https://kfkbomvzqfozrhcmgjmg.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtma2JvbXZ6cWZvenJoY21nam1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjU5NjMsImV4cCI6MjA5NjM0MTk2M30.yO4ZK3z3HsfnS0z3pqSGOhIOWEgmfLNYNY5KXUD7nvo";

const supabase = createClient(supabaseUrl, supabaseKey);

const article = {
  title:
    "Advancing conversational diagnostic AI with multimodal reasoning",
  authors: ["Google Research / DeepMind team"],
  journal: "Nature Medicine",
  doi: "10.1038/s41591-026-04371-0",
  abstract:
    "Multimodal AMIE extends conversational diagnostic AI to gather, interpret and reason about multimodal data (dermatology photos, ECGs, clinical documents) within diagnostic conversations using state-aware dialogue. In 105 simulated telehealth consultations, it outperformed primary care physicians on 29 of 32 evaluation axes including diagnostic accuracy, history-taking, empathy, and multimodal reasoning.",
  publication_date: "2026-05-14",
};

const insights = [
  {
    insight_type: "ai_method",
    title: "State-aware dialogue framework for diagnostic uncertainty",
    content:
      "Multimodal AMIE uses a state-aware dialogue framework that dynamically guides history-taking based on diagnostic uncertainty and evolving patient states, emulating structured clinical reasoning rather than static question lists.",
    evidence_quote:
      "state-aware dialogue framework that dynamically guides history-taking based on diagnostic uncertainty",
    confidence: 0.95,
    tags: ["state-aware", "dialogue", "history-taking", "diagnostic-uncertainty"],
  },
  {
    insight_type: "treatment_application",
    title: "Multimodal telehealth diagnostic consultations",
    content:
      "The system conducts text-based telehealth consultations that integrate patient history with visual artifacts including dermatology photographs, electrocardiograms, and clinical documents — mirroring real remote care workflows.",
    evidence_quote:
      "105 simulated telehealth consultations, which included dermatology photographs, electrocardiograms and clinical documents",
    confidence: 0.97,
    tags: ["telehealth", "multimodal", "dermatology", "ECG", "clinical-documents"],
  },
  {
    insight_type: "clinical_outcome",
    title: "Superior performance vs PCPs on 29/32 axes",
    content:
      "Specialist physician evaluators rated multimodal AMIE as outperforming board-certified primary care physicians on 29 of 32 evaluation axes, including diagnostic accuracy, conversation quality, history-taking, and empathy.",
    evidence_quote:
      "multimodal AMIE outperformed PCPs not only in diagnostic accuracy but also in conversation quality",
    confidence: 0.93,
    tags: ["diagnostic-accuracy", "PCP-comparison", "conversation-quality"],
  },
  {
    insight_type: "clinical_outcome",
    title: "Strong multimodal reasoning on dedicated MUH rubric",
    content:
      "A Multimodal Understanding and Handling (MUH) rubric assessed artifact interpretation across multiple dimensions. AMIE exceeded PCPs on 7 of 9 multimodal reasoning metrics.",
    evidence_quote:
      "seven of nine metrics that assess multimodal reasoning",
    confidence: 0.92,
    tags: ["MUH-rubric", "multimodal-reasoning", "artifact-interpretation"],
  },
  {
    insight_type: "ai_method",
    title: "OSCE-style blinded evaluation methodology",
    content:
      "Evaluation used a randomized, blinded OSCE-style study with validated patient-actors and specialist raters — a structured approach borrowed from medical education and licensing exams.",
    evidence_quote:
      "randomized, blinded OSCE-style study comparing the system against board-certified PCPs",
    confidence: 0.94,
    tags: ["OSCE", "evaluation-methodology", "patient-actors"],
  },
  {
    insight_type: "patient_population",
    title: "105 simulated multimodal clinical scenarios",
    content:
      "The study comprised 105 carefully designed multimodal clinical scenarios with validated patient-actors, covering diverse conditions requiring integration of text and visual clinical data.",
    evidence_quote: "105 carefully designed multimodal clinical scenarios with validated patient-actors",
    confidence: 0.96,
    tags: ["simulated-patients", "clinical-scenarios", "n=105"],
  },
  {
    insight_type: "limitation",
    title: "Exploratory study, not a clinical trial",
    content:
      "Authors explicitly note this is an exploratory study, not a randomized clinical trial with prespecified endpoints or preregistered statistical analysis. Real-world clinical deployment evidence remains limited.",
    evidence_quote:
      "our study is not a randomized clinical trial with prespecified endpoints and preregistered statistical analysis",
    confidence: 0.98,
    tags: ["exploratory", "not-RCT", "simulation-only"],
  },
  {
    insight_type: "limitation",
    title: "Text-only prior LLM diagnostic evaluations",
    content:
      "Prior LLM diagnostic dialogue research was largely restricted to text-only interactions, failing to capture the multimodal complexity of modern remote care — a gap this work addresses but also highlights how early the field is.",
    evidence_quote:
      "evaluation has been largely restricted to text-only interactions, failing to capture the complexity of modern remote care delivery",
    confidence: 0.9,
    tags: ["text-only-baseline", "evaluation-gap"],
  },
  {
    insight_type: "implementation_barrier",
    title: "Healthcare access and clinician burnout context",
    content:
      "The motivation centers on aging populations, care fragmentation, clinician burnout, and limited primary care access — AI augmentation is framed as addressing systemic delivery challenges, not just diagnostic accuracy.",
    evidence_quote:
      "aging populations and increasing care fragmentation through to clinician burnout",
    confidence: 0.88,
    tags: ["access", "burnout", "primary-care-shortage"],
  },
  {
    insight_type: "future_direction",
    title: "Bridging text and visual information in AI diagnostics",
    content:
      "Results validate state-aware reasoning as a mechanism to bridge text and visual clinical information, suggesting future AI systems should prioritize dynamic uncertainty-driven dialogue over static multimodal pipelines.",
    evidence_quote:
      "validate the efficacy of state-aware reasoning in bridging the gap between text and visual information",
    confidence: 0.91,
    tags: ["state-aware-reasoning", "multimodal-integration"],
  },
  {
    insight_type: "key_finding",
    title: "Empathy rated alongside diagnostic accuracy",
    content:
      "Unlike many AI diagnostic benchmarks focused solely on accuracy, this evaluation explicitly measured empathy and communication skills — areas where AMIE also exceeded PCP ratings.",
    evidence_quote:
      "communication skills, empathy and the understanding and handling of multimodal data",
    confidence: 0.9,
    tags: ["empathy", "communication", "holistic-evaluation"],
  },
  {
    insight_type: "ai_method",
    title: "Builds on prior text-only AMIE system",
    content:
      "Multimodal AMIE extends the Articulate Medical Intelligence Explorer (AMIE), an LLM-based conversational diagnostic system that previously demonstrated physician-like text-based consultation capabilities.",
    evidence_quote:
      "multimodal extension of the Articulate Medical Intelligence Explorer (multimodal AMIE)",
    confidence: 0.95,
    tags: ["AMIE", "LLM", "conversational-AI", "Google"],
  },
];

async function main() {
  const pdfPath = "articles/s41591-026-04371-0.pdf";
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const text = result.pages.map((p) => p.text).join("\n\n");
  await parser.destroy();

  const { data: articleRow, error: articleError } = await supabase
    .from("articles")
    .insert({
      ...article,
      file_path: "s41591-026-04371-0.pdf",
      raw_text: text,
      status: "processing",
    })
    .select()
    .single();

  if (articleError) throw articleError;
  console.log(`Article created: ${articleRow.id}`);

  const storagePath = `${articleRow.id}/s41591-026-04371-0.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("articles")
    .upload(storagePath, buffer, { contentType: "application/pdf" });

  if (uploadError) {
    console.warn("PDF upload warning:", uploadError.message);
  } else {
    await supabase
      .from("articles")
      .update({ file_path: storagePath })
      .eq("id", articleRow.id);
    console.log("PDF uploaded to storage");
  }

  for (const insight of insights) {
    const { error } = await supabase.from("insights").insert({
      article_id: articleRow.id,
      ...insight,
    });
    if (error) throw error;
    console.log(`  ✓ ${insight.insight_type}: ${insight.title}`);
  }

  await supabase
    .from("articles")
    .update({ status: "complete" })
    .eq("id", articleRow.id);

  console.log(`\nSeeded ${insights.length} insights for article ${articleRow.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
