"use client";

import ArticleLink from "@/components/ArticleLink";
import KnowledgeChat from "@/components/KnowledgeChat";
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

type Cluster = {
  id: string;
  label: string;
  keywords: string[];
  description: string;
  position: { x: number; y: number; z: number; w: number };
  color: string;
  insightCount: number;
  articleCount: number;
  insights: {
    id: string;
    title: string;
    content: string;
    insight_type: string;
    article_id: string;
  }[];
  articles: {
    id: string;
    title: string | null;
    journal: string | null;
    doi: string | null;
    abstract: string | null;
  }[];
};

type Definition = {
  id: string;
  term: string;
  definition: string;
  category: string;
  importance: string;
  related_terms: string[];
};

type Highlight = {
  id: string;
  highlight_type: string;
  title: string;
  description: string;
  relevance_score: number | null;
  business_theme: string | null;
  article_id: string | null;
  article: {
    id: string;
    title: string | null;
    journal: string | null;
    doi: string | null;
  } | null;
};

type ExploreData = {
  clusters: Cluster[];
  definitions: Definition[];
  highlights: {
    keyPoints: Highlight[];
    limitations: Highlight[];
    papersToExplore: Highlight[];
  };
};

function ClusterSphere({
  cluster,
  selected,
  wFilter,
  onSelect,
}: {
  cluster: Cluster;
  selected: boolean;
  wFilter: number;
  onSelect: (c: Cluster) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const visible = cluster.position.w >= wFilter;
  const scale = visible ? 0.3 + cluster.position.w * 0.5 : 0.01;
  const opacity = visible ? 0.4 + cluster.position.w * 0.6 : 0.05;

  useFrame((_, delta) => {
    if (!ref.current || !visible) return;
    const target = selected ? scale * 1.4 : scale;
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), delta * 5);
  });

  if (!visible) return null;

  return (
    <group
      position={[cluster.position.x, cluster.position.y, cluster.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(cluster);
      }}
    >
      <mesh ref={ref}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={cluster.color}
          emissive={cluster.color}
          emissiveIntensity={selected ? 0.7 : 0.3}
          transparent
          opacity={opacity}
          roughness={0.3}
        />
      </mesh>
      <Html center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div className="w-36 text-center">
          <p className="text-sm font-bold text-white drop-shadow-lg">{cluster.label}</p>
          <p className="mt-0.5 text-[10px] text-stone-300 drop-shadow">
            {cluster.keywords.slice(0, 3).join(" · ")}
          </p>
          <p className="text-[9px] text-stone-400">
            {cluster.articleCount} papers · w={(cluster.position.w * 100).toFixed(0)}%
          </p>
        </div>
      </Html>
    </group>
  );
}

function Scene({
  clusters,
  selected,
  wFilter,
  onSelect,
}: {
  clusters: Cluster[];
  selected: Cluster | null;
  wFilter: number;
  onSelect: (c: Cluster) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <pointLight position={[-8, -5, -8]} intensity={0.3} color="#a8a29e" />
      {clusters.map((c) => (
        <ClusterSphere
          key={c.id}
          cluster={c}
          selected={selected?.id === c.id}
          wFilter={wFilter}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls enableDamping dampingFactor={0.08} />
    </>
  );
}

function ClusterChat({ cluster, onClose }: { cluster: Cluster; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-700 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-stone-100">Context Channel</p>
          <p className="text-xs text-stone-500">{cluster.label}</p>
        </div>
        <button onClick={onClose} className="text-xs text-stone-500 hover:text-stone-300">
          Close
        </button>
      </div>
      <KnowledgeChat clusterId={cluster.id} clusterLabel={cluster.label} variant="embedded" />
    </div>
  );
}

export default function TopicExploreMap() {
  const [data, setData] = useState<ExploreData | null>(null);
  const [selected, setSelected] = useState<Cluster | null>(null);
  const [wFilter, setWFilter] = useState(0);
  const [tab, setTab] = useState<"papers" | "insights" | "chat" | "definitions">("papers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/explore/topics")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-950 text-stone-500">
        Building knowledge graph...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-950 text-red-400">
        {error ?? "Failed to load"} — run npm run build-graph
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-stone-950">
      <div className="relative flex-1">
        <Canvas camera={{ fov: 50, position: [0, 0, 16] }} className="bg-stone-950">
          <Scene
            clusters={data.clusters}
            selected={selected}
            wFilter={wFilter}
            onSelect={(c) => {
              setSelected(c);
              setTab("papers");
            }}
          />
        </Canvas>

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
          <div className="pointer-events-auto w-72 rounded-xl border border-stone-700 bg-stone-900/95 p-4 backdrop-blur">
            <h2 className="text-sm font-semibold text-stone-100">4D Topic Map</h2>
            <p className="mt-1 text-xs text-stone-400">
              Clusters sized by Shifu relevance (W). Click a cluster to explore papers and chat.
            </p>
            <div className="mt-3">
              <label className="text-xs text-stone-500">
                W filter: {(wFilter * 100).toFixed(0)}%+
              </label>
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={wFilter}
                onChange={(e) => setWFilter(Number(e.target.value))}
                className="mt-1 w-full accent-stone-400"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="font-semibold text-stone-200">{data.clusters.length}</p>
                <p className="text-stone-500">topics</p>
              </div>
              <div>
                <p className="font-semibold text-stone-200">{data.definitions.length}</p>
                <p className="text-stone-500">terms</p>
              </div>
              <div>
                <p className="font-semibold text-stone-200">
                  {data.highlights.keyPoints.length}
                </p>
                <p className="text-stone-500">key pts</p>
              </div>
            </div>
          </div>

          {!selected && (
            <div className="pointer-events-auto max-w-md rounded-xl border border-stone-700 bg-stone-900/95 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Shifu Thesis Highlights
              </p>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                {data.highlights.keyPoints.slice(0, 4).map((h) => (
                  <div key={h.id} className="text-xs">
                    <span className="font-medium text-green-400">Key: </span>
                    <span className="text-stone-300">{h.title}</span>
                    {h.article && (
                      <ArticleLink
                        title={h.article.title}
                        doi={h.article.doi}
                        journal={h.article.journal}
                        variant="dark"
                        className="mt-0.5"
                      />
                    )}
                  </div>
                ))}
                {data.highlights.limitations.slice(0, 3).map((h) => (
                  <div key={h.id} className="text-xs">
                    <span className="font-medium text-red-400">Limit: </span>
                    <span className="text-stone-300">{h.title}</span>
                    {h.article && (
                      <ArticleLink
                        title={h.article.title}
                        doi={h.article.doi}
                        journal={h.article.journal}
                        variant="dark"
                        className="mt-0.5"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="flex w-[420px] flex-col border-l border-stone-800 bg-stone-900">
          <div className="border-b border-stone-800 p-4">
            <h2 className="text-lg font-semibold text-stone-100">{selected.label}</h2>
            <p className="mt-1 text-xs text-stone-400">{selected.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {selected.keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${selected.color}33`, color: selected.color }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>

          <div className="flex border-b border-stone-800 text-xs">
            {(["papers", "insights", "chat", "definitions"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 capitalize transition-colors ${
                  tab === t
                    ? "border-b-2 border-stone-100 text-stone-100"
                    : "text-stone-500 hover:text-stone-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {tab === "papers" && (
              <div className="h-full overflow-y-auto p-4 space-y-3">
                {selected.articles.map((a) => (
                  <div key={a.id} className="rounded-lg border border-stone-700 p-3">
                    <h3 className="text-sm font-medium text-stone-100">{a.title}</h3>
                    {a.journal && <p className="text-xs text-stone-500">{a.journal}</p>}
                    {a.doi && (
                      <a
                        href={`https://doi.org/${a.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                      >
                        doi:{a.doi}
                      </a>
                    )}
                    {a.abstract && (
                      <p className="mt-2 text-xs leading-relaxed text-stone-400 line-clamp-4">
                        {a.abstract}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === "insights" && (
              <div className="h-full overflow-y-auto p-4 space-y-3">
                {selected.insights.map((i) => {
                  const article = selected.articles.find((a) => a.id === i.article_id);
                  return (
                  <div key={i.id} className="rounded-lg border border-stone-700 p-3">
                    <span className="text-[10px] uppercase tracking-wider text-stone-500">
                      {i.insight_type.replace(/_/g, " ")}
                    </span>
                    <h3 className="mt-1 text-sm font-medium text-stone-100">{i.title}</h3>
                    {article && (
                      <ArticleLink
                        title={article.title}
                        doi={article.doi}
                        journal={article.journal}
                        variant="dark"
                        className="mt-1"
                      />
                    )}
                    <p className="mt-1 text-xs leading-relaxed text-stone-400">{i.content}</p>
                  </div>
                  );
                })}
              </div>
            )}

            {tab === "chat" && <ClusterChat cluster={selected} onClose={() => setSelected(null)} />}

            {tab === "definitions" && (
              <div className="h-full overflow-y-auto p-4 space-y-3">
                {data.definitions
                  .filter(
                    (d) =>
                      selected.keywords.some((kw) =>
                        d.term.toLowerCase().includes(kw.toLowerCase()),
                      ) || d.importance === "core",
                  )
                  .slice(0, 15)
                  .map((d) => (
                    <div key={d.id} className="rounded-lg border border-stone-700 p-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-stone-100">{d.term}</h3>
                        <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-500">
                          {d.importance}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-stone-400">
                        {d.definition}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
