"use client";

import { useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STARTER_PROMPTS = [
  "What are the most important findings for Shifu?",
  "Which papers should we read first?",
  "What limitations should we be aware of?",
  "How does the research compare to Shifu's approach?",
];

type KnowledgeChatProps = {
  clusterId?: string;
  clusterLabel?: string;
  variant?: "page" | "embedded";
};

export default function KnowledgeChat({
  clusterId,
  clusterLabel,
  variant = "page",
}: KnowledgeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text?: string) {
    const userMsg = (text ?? input).trim();
    if (!userMsg || loading) return;

    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: messages,
          clusterId,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "Something went wrong"}`,
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  const isDark = variant === "embedded";

  return (
    <div
      className={`flex flex-col ${
        variant === "page" ? "mx-auto max-w-3xl flex-1" : "h-full"
      }`}
    >
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-4 py-6 ${
          variant === "page" ? "space-y-6" : "space-y-3"
        }`}
      >
        {messages.length === 0 && (
          <div className={variant === "page" ? "text-center" : ""}>
            <p
              className={`text-sm ${isDark ? "text-stone-400" : "text-stone-600"} ${
                variant === "page" ? "mx-auto max-w-md" : ""
              }`}
            >
              {clusterLabel
                ? `Ask anything about the "${clusterLabel}" topic cluster — insights, papers, and Shifu relevance.`
                : "Ask anything about the research library — insights, papers, business alignments, and how they relate to Shifu."}
            </p>
            <div
              className={`mt-4 flex flex-wrap gap-2 ${
                variant === "page" ? "justify-center" : ""
              }`}
            >
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    isDark
                      ? "border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900"
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? isDark
                    ? "bg-stone-100 text-stone-900"
                    : "bg-stone-900 text-stone-100"
                  : isDark
                    ? "border border-stone-700 bg-stone-900 text-stone-300"
                    : "border border-stone-200 bg-white text-stone-700"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <p className={`text-xs ${isDark ? "text-stone-500" : "text-stone-400"} animate-pulse`}>
            Searching knowledge base...
          </p>
        )}
      </div>

      <div
        className={`border-t p-4 ${
          isDark ? "border-stone-700" : "border-stone-200 bg-white"
        }`}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about insights, papers, or Shifu relevance..."
            className={`flex-1 rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
              isDark
                ? "border-stone-600 bg-stone-900 text-stone-100 placeholder:text-stone-600 focus:ring-stone-500"
                : "border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 focus:ring-stone-300"
            }`}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              isDark
                ? "bg-stone-100 text-stone-900 hover:bg-white"
                : "bg-stone-900 text-stone-100 hover:bg-stone-800"
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
