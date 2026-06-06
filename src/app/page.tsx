import { supabase, type Article, type Insight, type SynthesisIdea } from "@/lib/supabase";
import Nav from "@/components/Nav";

const INSIGHT_TYPE_LABELS: Record<string, string> = {
  treatment_application: "Treatment Application",
  clinical_outcome: "Clinical Outcome",
  ai_method: "AI Method",
  patient_population: "Patient Population",
  limitation: "Limitation",
  future_direction: "Future Direction",
  implementation_barrier: "Implementation Barrier",
  key_finding: "Key Finding",
};

const INSIGHT_TYPE_COLORS: Record<string, string> = {
  treatment_application: "bg-blue-100 text-blue-800",
  clinical_outcome: "bg-green-100 text-green-800",
  ai_method: "bg-purple-100 text-purple-800",
  patient_population: "bg-amber-100 text-amber-800",
  limitation: "bg-red-100 text-red-800",
  future_direction: "bg-teal-100 text-teal-800",
  implementation_barrier: "bg-orange-100 text-orange-800",
  key_finding: "bg-indigo-100 text-indigo-800",
};

async function getData() {
  const [articlesRes, insightsRes, ideasRes] = await Promise.all([
    supabase.from("articles").select("*").order("created_at", { ascending: false }),
    supabase.from("insights").select("*").order("created_at", { ascending: false }),
    supabase.from("synthesis_ideas").select("*").order("created_at", { ascending: false }),
  ]);

  return {
    articles: (articlesRes.data ?? []) as Article[],
    insights: (insightsRes.data ?? []) as Insight[],
    ideas: (ideasRes.data ?? []) as SynthesisIdea[],
  };
}

export default async function Home() {
  const { articles, insights, ideas } = await getData();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-stone-500">
                Medical AI Research
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-stone-900">
                Knowledge Base
              </h1>
            </div>
            <Nav />
          </div>
          <p className="mt-2 max-w-2xl text-stone-600">
            Insights extracted from research articles on AI in medical treatments
            and diagnostics.
          </p>
          <div className="mt-6 flex gap-6 text-sm">
            <Stat label="Articles" value={articles.length} />
            <Stat label="Insights" value={insights.length} />
            <Stat label="Ideas" value={ideas.length} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-6 py-10">
        {ideas.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-stone-900">
              Synthesis Ideas
            </h2>
            <div className="space-y-4">
              {ideas.map((idea) => (
                <div
                  key={idea.id}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-medium text-stone-900">{idea.title}</h3>
                    {idea.novelty_score && (
                      <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                        {(idea.novelty_score * 100).toFixed(0)}% novelty
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">
                    {idea.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-lg font-semibold text-stone-900">Articles</h2>
          <div className="space-y-4">
            {articles.map((article) => (
              <article
                key={article.id}
                className="rounded-xl border border-stone-200 bg-white p-6"
              >
                <h3 className="text-xl font-medium text-stone-900">
                  {article.title ?? "Untitled"}
                </h3>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-stone-500">
                  {article.journal && <span>{article.journal}</span>}
                  {article.doi && (
                    <a
                      href={`https://doi.org/${article.doi}`}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      doi:{article.doi}
                    </a>
                  )}
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    {article.status}
                  </span>
                </div>
                {article.abstract && (
                  <p className="mt-3 text-sm leading-relaxed text-stone-600">
                    {article.abstract}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-stone-900">
            Extracted Insights
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-xl border border-stone-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${INSIGHT_TYPE_COLORS[insight.insight_type] ?? "bg-stone-100 text-stone-700"}`}
                  >
                    {INSIGHT_TYPE_LABELS[insight.insight_type] ??
                      insight.insight_type}
                  </span>
                  {insight.confidence && (
                    <span className="text-xs text-stone-400">
                      {(insight.confidence * 100).toFixed(0)}% conf.
                    </span>
                  )}
                </div>
                <h3 className="mt-3 font-medium text-stone-900">
                  {insight.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {insight.content}
                </p>
                {insight.evidence_quote && (
                  <blockquote className="mt-3 border-l-2 border-stone-300 pl-3 text-xs italic text-stone-500">
                    &ldquo;{insight.evidence_quote}&rdquo;
                  </blockquote>
                )}
                {insight.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {insight.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="text-2xl font-semibold text-stone-900">{value}</span>
      <span className="ml-2 text-stone-500">{label}</span>
    </div>
  );
}
