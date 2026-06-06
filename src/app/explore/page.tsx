import Link from "next/link";
import ExploreClient from "@/components/ExploreClient";

export default function ExplorePage() {
  return (
    <div className="h-screen">
      <nav className="absolute top-0 left-0 right-0 z-10 flex h-12 items-center gap-6 border-b border-stone-800/50 bg-stone-950/80 px-6 backdrop-blur">
        <Link href="/" className="text-xs font-medium text-stone-500 hover:text-stone-300">
          Knowledge Base
        </Link>
        <Link href="/map" className="text-xs font-medium text-stone-500 hover:text-stone-300">
          Insight Map
        </Link>
        <span className="text-xs font-medium text-stone-200">Explore</span>
        <Link href="/chat" className="text-xs font-medium text-stone-500 hover:text-stone-300">
          Chat
        </Link>
      </nav>
      <div className="h-full pt-12">
        <ExploreClient />
      </div>
    </div>
  );
}
