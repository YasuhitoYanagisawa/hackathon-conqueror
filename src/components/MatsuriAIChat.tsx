import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askMatsuriAI } from "@/lib/api/chat.functions";
import { buildRagContext } from "@/lib/rag";
import type { Festival } from "@/data/festivals";

type Msg = { role: "user" | "assistant"; content: string };

export function MatsuriAIChat({ festivals }: { festivals?: Festival[] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "祭りAIです。アプリ内のお祭りDB(29,000件超)を参照して回答します。地域名・時期・キーワードを添えて聞いてください。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askMatsuriAI);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const context =
        festivals && festivals.length
          ? buildRagContext(text, festivals, { limit: 100 })
          : undefined;
      const res = await ask({ data: { messages: next, context } });
      setMessages([...next, { role: "assistant", content: res.reply || "…" }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "通信エラーが発生しました。" }]);
    } finally {
      setLoading(false);
    }
  }


  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 rounded-full w-14 h-14 grid place-items-center text-2xl shadow-lg"
        style={{
          background: "var(--gradient-lantern)",
          color: "white",
          boxShadow: "var(--shadow-lantern)",
        }}
        aria-label="祭りAIを開く"
      >
        {open ? "×" : "祭"}
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-5 z-40 w-[92vw] max-w-sm rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: "oklch(0.16 0.04 270)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-card)",
            maxHeight: "70vh",
          }}
        >
          <div
            className="px-4 py-3 text-sm font-bold text-white"
            style={{ background: "var(--gradient-lantern)" }}
          >
            祭りAIガイド
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`px-3 py-2 rounded-xl max-w-[85%] whitespace-pre-wrap ${
                  m.role === "user" ? "ml-auto" : "mr-auto"
                }`}
                style={{
                  background:
                    m.role === "user" ? "var(--color-gold)" : "oklch(0.22 0.04 270)",
                  color: m.role === "user" ? "oklch(0.15 0.04 270)" : "white",
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="text-xs text-muted-foreground">考え中…</div>
            )}
          </div>

          <div className="p-3 border-t flex gap-2" style={{ borderColor: "var(--color-border)" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="例: 夏におすすめの祭りは?"
              className="flex-1 rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none"
              style={{ border: "1px solid var(--color-border)" }}
            />
            <button
              onClick={send}
              disabled={loading}
              className="px-4 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "var(--gradient-lantern)" }}
            >
              送信
            </button>
          </div>
        </div>
      )}
    </>
  );
}
