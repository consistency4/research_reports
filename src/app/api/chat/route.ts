import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildChatContext, buildChatSystemPrompt } from "@/lib/chat-context";

export async function POST(req: NextRequest) {
  try {
    const { message, history = [], clusterId } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const context = await buildChatContext(message.trim(), clusterId);
    const systemPrompt = buildChatSystemPrompt(context);

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const messages = [
      ...history.slice(-10).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message.trim() },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const reply = response.content.find((b) => b.type === "text")?.text ?? "";

    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
