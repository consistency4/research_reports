import Nav from "@/components/Nav";
import KnowledgeChat from "@/components/KnowledgeChat";

export default function ChatPage() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-6 py-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-stone-500">
              Research Assistant
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-stone-900">Ask the Knowledge Base</h1>
            <p className="mt-1 text-sm text-stone-500">
              Query insights, papers, and Shifu business alignments across the full library.
            </p>
          </div>
          <Nav />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <KnowledgeChat variant="page" />
      </main>
    </div>
  );
}
