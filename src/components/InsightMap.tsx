"use client";

import ArticleLink from "@/components/ArticleLink";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

type MapNode = {
  id: string;
  articleId: string;
  title: string;
  content: string;
  type: string;
  color: string;
  confidence: number | null;
  tags: string[];
  evidenceQuote: string | null;
  position: { x: number; y: number; z: number };
};

type MapLink = {
  source: string;
  target: string;
  type: string;
  strength: number | null;
  description: string | null;
};

type MapData = {
  nodes: MapNode[];
  links: MapLink[];
  articles: { id: string; title: string | null; journal: string | null; doi: string | null }[];
};

const TYPE_LABELS: Record<string, string> = {
  treatment_application: "Treatment",
  clinical_outcome: "Outcome",
  ai_method: "AI Method",
  patient_population: "Population",
  limitation: "Limitation",
  future_direction: "Future",
  implementation_barrier: "Barrier",
  key_finding: "Key Finding",
};

function normalizePositions(nodes: MapNode[]): MapNode[] {
  if (nodes.length === 0) return nodes;

  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  const zs = nodes.map((n) => n.position.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const scale = 8 / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.001);

  return nodes.map((n) => ({
    ...n,
    position: {
      x: (n.position.x - (minX + maxX) / 2) * scale,
      y: (n.position.y - (minY + maxY) / 2) * scale,
      z: (n.position.z - (minZ + maxZ) / 2) * scale,
    },
  }));
}

function InsightNode({
  node,
  selected,
  onSelect,
}: {
  node: MapNode;
  selected: boolean;
  onSelect: (node: MapNode | null) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = selected || hovered ? 0.22 : 0.14;
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), delta * 6);
  });

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(selected ? null : node);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={selected ? 0.6 : hovered ? 0.35 : 0.15}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      {(hovered || selected) && (
        <Html distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div className="w-48 -translate-x-1/2 rounded-lg border border-stone-700 bg-stone-900/95 px-3 py-2 text-xs text-stone-100 shadow-lg">
            <p className="font-medium leading-snug">{node.title}</p>
            <p className="mt-1 text-stone-400">{TYPE_LABELS[node.type] ?? node.type}</p>
          </div>
        </Html>
      )}
    </group>
  );
}

function ConnectionLines({
  nodes,
  links,
}: {
  nodes: MapNode[];
  links: MapLink[];
}) {
  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n.position])),
    [nodes],
  );

  return (
    <>
      {links.map((link) => {
        const a = nodeMap.get(link.source);
        const b = nodeMap.get(link.target);
        if (!a || !b) return null;
        return (
          <Line
            key={`${link.source}-${link.target}`}
            points={[
              [a.x, a.y, a.z],
              [b.x, b.y, b.z],
            ]}
            color="#57534e"
            lineWidth={1}
            transparent
            opacity={0.35}
          />
        );
      })}
    </>
  );
}

function Scene({
  nodes,
  links,
  selected,
  onSelect,
}: {
  nodes: MapNode[];
  links: MapLink[];
  selected: MapNode | null;
  onSelect: (node: MapNode | null) => void;
}) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, 14);
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />
      <pointLight position={[-10, -8, -6]} intensity={0.4} color="#a8a29e" />
      <ConnectionLines nodes={nodes} links={links} />
      {nodes.map((node) => (
        <InsightNode
          key={node.id}
          node={node}
          selected={selected?.id === node.id}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls enableDamping dampingFactor={0.08} />
    </>
  );
}

export default function InsightMap() {
  const [data, setData] = useState<MapData | null>(null);
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/insights/map")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData({
          ...d,
          nodes: normalizePositions(d.nodes),
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const legend = useMemo(() => {
    if (!data) return [];
    const types = [...new Set(data.nodes.map((n) => n.type))];
    return types.map((type) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      color: data.nodes.find((n) => n.type === type)?.color ?? "#78716c",
      count: data.nodes.filter((n) => n.type === type).length,
    }));
  }, [data]);

  const articleMap = useMemo(
    () => new Map((data?.articles ?? []).map((a) => [a.id, a])),
    [data],
  );
  const selectedArticle = selected ? articleMap.get(selected.articleId) : null;

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-stone-500">
        Loading vector map...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-red-600">
        {error ?? "Failed to load map data"}
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 1000 }}
        className="bg-stone-950"
        onPointerMissed={() => setSelected(null)}
      >
        <Scene
          nodes={data.nodes}
          links={data.links}
          selected={selected}
          onSelect={setSelected}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex">
        <div className="pointer-events-auto m-6 w-64 space-y-4">
          <div className="rounded-xl border border-stone-700 bg-stone-900/90 p-4 backdrop-blur">
            <h2 className="text-sm font-semibold text-stone-100">Insight Space</h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-400">
              Each point is an extracted insight, positioned by semantic similarity via PCA.
              Drag to rotate, scroll to zoom, click a point for details.
            </p>
            <div className="mt-3 flex gap-4 text-xs text-stone-400">
              <span>{data.nodes.length} points</span>
              <span>{data.links.length} links</span>
            </div>
          </div>

          <div className="rounded-xl border border-stone-700 bg-stone-900/90 p-4 backdrop-blur">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Categories
            </h3>
            <ul className="mt-2 space-y-1.5">
              {legend.map((item) => (
                <li key={item.type} className="flex items-center gap-2 text-xs text-stone-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-stone-500">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {selected && (
          <div className="pointer-events-auto ml-auto m-6 w-80">
            <div className="rounded-xl border border-stone-700 bg-stone-900/95 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${selected.color}22`,
                    color: selected.color,
                  }}
                >
                  {TYPE_LABELS[selected.type] ?? selected.type}
                </span>
                {selected.confidence && (
                  <span className="text-xs text-stone-500">
                    {(selected.confidence * 100).toFixed(0)}% conf.
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-medium text-stone-100">{selected.title}</h3>
              {selectedArticle && (
                <ArticleLink
                  title={selectedArticle.title}
                  doi={selectedArticle.doi}
                  journal={selectedArticle.journal}
                  variant="dark"
                  className="mt-2"
                />
              )}
              <p className="mt-2 text-sm leading-relaxed text-stone-400">
                {selected.content}
              </p>
              {selected.evidenceQuote && (
                <blockquote className="mt-3 border-l-2 border-stone-600 pl-3 text-xs italic text-stone-500">
                  &ldquo;{selected.evidenceQuote}&rdquo;
                </blockquote>
              )}
              {selected.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {selected.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-stone-800 px-2 py-0.5 text-xs text-stone-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => setSelected(null)}
                className="mt-4 text-xs text-stone-500 hover:text-stone-300"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
