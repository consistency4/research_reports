import Link from "next/link";
import MapClient from "@/components/MapClient";

export default function MapPage() {
  return (
    <div className="min-h-screen bg-stone-950">
      <nav className="flex h-16 items-center justify-between border-b border-stone-800 px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-stone-400 hover:text-stone-200">
            Knowledge Base
          </Link>
          <Link href="/explore" className="text-sm font-medium text-stone-400 hover:text-stone-200">
            Explore
          </Link>
          <Link href="/chat" className="text-sm font-medium text-stone-400 hover:text-stone-200">
            Chat
          </Link>
          <span className="text-sm font-medium text-stone-100">Insight Map</span>
        </div>
        <p className="text-xs text-stone-500">PCA projection of insight embeddings</p>
      </nav>
      <MapClient />
    </div>
  );
}
