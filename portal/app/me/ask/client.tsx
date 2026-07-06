"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { t, type Lang } from "@/lib/i18n/dictionary";

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; sources?: Source[] };

type Source = { edition_id: string; edition_number: number; subject: string; pillar: string | null };

export function AskClient({ lang }: { lang: Lang }) {
  const i18n = t(lang).ask;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || pending) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((cur) => [...cur, { role: "user", content: userMessage }, { role: "assistant", content: "" }]);
    setPending(true);

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        lang,
        conversation_id: conversationIdRef.current,
      }),
    });

    if (!res.ok || !res.body) {
      let errorMessage = "Error contacting the assistant.";
      try {
        const errorJson = await res.json();
        if (errorJson?.details) {
          errorMessage += ` (${errorJson.details})`;
        } else if (errorJson?.error) {
          errorMessage += ` (${errorJson.error})`;
        }
      } catch {
        // Fallback if not JSON or parsing fails
      }
      setMessages((cur) => {
        const copy = [...cur];
        copy[copy.length - 1] = { role: "assistant", content: errorMessage };
        return copy;
      });
      setPending(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const evt of events) {
        const lines = evt.split("\n");
        const event = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
        const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
        if (!event || !dataLine) continue;
        let payload: { text?: string; conversation_id?: string; sources?: Source[]; message?: string };
        try { payload = JSON.parse(dataLine); } catch { continue; }

        if (event === "meta") {
          if (payload.conversation_id) conversationIdRef.current = payload.conversation_id;
          setMessages((cur) => {
            const copy = [...cur];
            copy[copy.length - 1] = { ...(copy[copy.length - 1] as Message), sources: payload.sources } as Message;
            return copy;
          });
        }
        if (event === "token" && payload.text) {
          setMessages((cur) => {
            const copy = [...cur];
            const last = copy[copy.length - 1] as Message;
            copy[copy.length - 1] = { ...last, content: last.content + payload.text };
            return copy;
          });
        }
        if (event === "error" && payload.message) {
          setMessages((cur) => {
            const copy = [...cur];
            const last = copy[copy.length - 1] as Message;
            copy[copy.length - 1] = { ...last, content: last.content + `\n\n[error: ${payload.message}]` };
            return copy;
          });
        }
      }

      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    setPending(false);
  }

  return (
    <div>
      <ol className="space-y-6 mb-8">
        {messages.length === 0 ? (
          <li className="text-[var(--color-fg-muted)]">{i18n.emptyState}</li>
        ) : null}
        {messages.map((m, i) => (
          <li key={i} className={m.role === "user" ? "" : "card"}>
            <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              {m.role === "user" ? (lang === "es" ? "Tú" : "You") : "Transformation AI"}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content || (pending ? i18n.thinking : "")}</div>
            {m.role === "assistant" && m.sources && m.sources.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-[var(--color-line)] text-sm">
                <div className="text-[var(--color-fg-muted)] mb-1">{i18n.sources}</div>
                <ul className="space-y-1">
                  {m.sources.map((s) => (
                    <li key={s.edition_id}>
                      <Link href={`/archive/${s.edition_id}`}>
                        #{s.edition_number} — {s.subject}
                      </Link>
                      {s.pillar ? <span className="text-[var(--color-fg-muted)]"> · {s.pillar}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <div ref={bottomRef} />

      <form onSubmit={handleSubmit} className="sticky bottom-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={i18n.placeholder}
          className="field-input flex-1"
          disabled={pending}
        />
        <button type="submit" disabled={pending || !input.trim()} className="btn btn-primary">
          {pending ? i18n.thinking : i18n.send}
        </button>
      </form>
    </div>
  );
}
