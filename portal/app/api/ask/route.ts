import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { buildSystemPrompt, buildContextBlock } from "@/lib/ai/prompt";
import { retrieveRelevantExcerpts } from "@/lib/ai/retrieval";
import { loadVoiceBible } from "@/lib/ai/voice-bible";
import { normalizeLang } from "@/lib/i18n/dictionary";

export const runtime = "nodejs";

const Body = z.object({
  conversation_id: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(4000),
  lang: z.enum(["en", "es"]).optional(),
});

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberData } = await supabase
    .from("members")
    .select("preferred_language, status")
    .eq("id", user.id)
    .maybeSingle();
  const member = memberData as Pick<Database["public"]["Tables"]["members"]["Row"], "preferred_language" | "status"> | null;
  if (!member || member.status !== "active") {
    return NextResponse.json({ error: "Membership required" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 422 });

  const lang = normalizeLang(parsed.data.lang ?? member.preferred_language ?? "en");

  let conversationId = parsed.data.conversation_id ?? null;
  if (!conversationId) {
    const conversationInsert: Database["public"]["Tables"]["ai_conversations"]["Insert"] = {
      member_id: user.id,
      title: parsed.data.message.slice(0, 80),
    };
    const { data: conv, error: convErr } = await (supabase
      .from("ai_conversations") as any)
      .insert(conversationInsert)
      .select("id")
      .single();
    if (convErr || !conv) return NextResponse.json({ error: "Could not create conversation" }, { status: 500 });
    conversationId = conv.id;
  }

  if (!conversationId) {
    return NextResponse.json({ error: "Could not create conversation" }, { status: 500 });
  }

  const userMessageInsert: Database["public"]["Tables"]["ai_messages"]["Insert"] = {
    conversation_id: conversationId,
    role: "user",
    content: parsed.data.message,
  };
  await (supabase.from("ai_messages") as any).insert(userMessageInsert);

  const { data: historyData } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);
  const history = historyData as Pick<Database["public"]["Tables"]["ai_messages"]["Row"], "role" | "content">[] | null;

  let excerpts: any[] = [];
  let stream: any;
  try {
    const voiceBible = await loadVoiceBible();
    excerpts = await retrieveRelevantExcerpts(parsed.data.message, lang, 5);
    const systemPrompt = [
      buildSystemPrompt(lang, voiceBible),
      buildContextBlock(excerpts),
    ].filter(Boolean).join("\n\n");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    const anthropic = new Anthropic({ apiKey });

    stream = await anthropic.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      system: systemPrompt,
      messages: (history ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });
  } catch (err) {
    console.error("AI Assistant Stream Init Error:", err);
    return NextResponse.json(
      { error: "Failed to initialize AI Assistant", details: (err as Error).message },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  let fullText = "";

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const meta = {
        conversation_id: conversationId,
        sources: excerpts.map((e) => ({
          edition_id: e.edition_id,
          edition_number: e.edition_number,
          subject: e.subject,
          pillar: e.pillar,
        })),
      };
      controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`));

      try {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            fullText += chunk.delta.text;
            controller.enqueue(
              encoder.encode(`event: token\ndata: ${JSON.stringify({ text: chunk.delta.text })}\n\n`),
            );
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`),
        );
      }

      const assistantMessageInsert: Database["public"]["Tables"]["ai_messages"]["Insert"] = {
        conversation_id: conversationId,
        role: "assistant",
        content: fullText,
        citations: excerpts.map((e) => ({
          edition_id: e.edition_id,
          quote: e.subject,
        })),
      };
      await (supabase.from("ai_messages") as any).insert(assistantMessageInsert);

      controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
