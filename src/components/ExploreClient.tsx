"use client";

import dynamic from "next/dynamic";

const TopicExploreMap = dynamic(() => import("@/components/TopicExploreMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-stone-950 text-stone-500">
      Loading explore map...
    </div>
  ),
});

export default function ExploreClient() {
  return <TopicExploreMap />;
}
