import Link from "next/link";

export default function Nav() {
  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/" className="font-medium text-stone-900">
        Articles
      </Link>
      <Link
        href="/map"
        className="text-stone-500 transition-colors hover:text-stone-900"
      >
        Insight Map
      </Link>
      <Link
        href="/explore"
        className="text-stone-500 transition-colors hover:text-stone-900"
      >
        Explore
      </Link>
      <Link
        href="/chat"
        className="text-stone-500 transition-colors hover:text-stone-900"
      >
        Chat
      </Link>
    </nav>
  );
}
