import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ⚠️ ハッカソンデモ用：本来はシークレットに格納すべき
const AZURE_ENDPOINT = "https://myresourcename.openai.azure.com";
const AZURE_API_KEY =
  "BH16u93PfZx5sjIQSIY6Kx6VF7r13ZtimeGK4EzaeJMNIMdqyolbJQQJ99CEACYeBjFXJ3w3AAABACOG3kjS";
const AZURE_DEPLOYMENT = "gpt-5.4-mini";
const AZURE_API_VERSION = "2024-12-01-preview";

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
    const url = `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "api-key": AZURE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "あなたは日本のお祭り・伝統行事に詳しいガイド『祭りAI』です。簡潔で温かい口調で、日本語で答えてください。",
            },
            ...data.messages,
          ],
          max_completion_tokens: 800,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("Azure OpenAI error:", res.status, errText);
        if (res.status === 429)
          return { reply: "リクエストが多すぎます。少し待って再試行してください。", error: "rate_limit" as const };
        if (res.status === 401 || res.status === 403)
          return { reply: "AI認証に失敗しました（キー/エンドポイント確認）。", error: "auth" as const };
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
