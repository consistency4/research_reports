"use client";

import dynamic from "next/dynamic";

const InsightMap = dynamic(() => import("@/components/InsightMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-stone-500">
      Loading vector map...
    </div>
  ),
});

export default function MapClient() {
  return <InsightMap />;
}
