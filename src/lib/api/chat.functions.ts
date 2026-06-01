import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const askMatsuriAI = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      messages: z.array(MessageSchema).min(1).max(20),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { reply: "AIキーが未設定です。", error: "no_key" as const };
    }

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "あなたは日本のお祭り・伝統行事に詳しいガイド『祭りAI』です。簡潔で温かい口調で、日本語で答えてください。",
            },
            ...data.messages,
          ],
        }),
      });

      if (!res.ok) {
        if (res.status === 429) return { reply: "リクエストが多すぎます。少し待って再試行してください。", error: "rate_limit" as const };
        if (res.status === 402) return { reply: "AIクレジットが不足しています。", error: "payment" as const };
        return { reply: "AIサービスでエラーが発生しました。", error: "upstream" as const };
      }

      const json = await res.json();
      const reply = json?.choices?.[0]?.message?.content ?? "";
      return { reply, error: null };
    } catch (e) {
      console.error("askMatsuriAI failed:", e);
      return { reply: "AIに接続できませんでした。", error: "network" as const };
    }
  });
