import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DEFAULT_AZURE_API_VERSION = "2024-12-01-preview";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const askMatsuriAI = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      messages: z.array(MessageSchema).min(1).max(20),
      context: z.string().max(12000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? DEFAULT_AZURE_API_VERSION;

    if (!endpoint || !apiKey || !deployment) {
      return { reply: "Azure OpenAI の環境変数が未設定です。", error: "config" as const };
    }

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const today = new Date().toISOString().slice(0, 10);
    const systemContent = [
      "あなたは日本のお祭り・伝統行事に詳しいガイド『祭りAI』です。",
      "簡潔で温かい口調で、日本語で答えてください。",
      `本日の日付: ${today}`,
      "",
      "【重要】以下の『関連お祭りDB抜粋』はアプリ内のお祭りDB(29,000件超)からユーザーの質問に関連するレコードを抽出したものです。",
      "回答は必ずこのDB抜粋の事実のみに基づいて行い、DBに無い情報は『DBには記載がありません』と明示してください。",
      "推測や一般論で日付・場所をでっち上げないでください。",
      "回答時は祭名・都道府県市区町村・開催日を明記してください。",
      "",
      "--- 関連お祭りDB抜粋 ---",
      data.context ?? "(関連データなし)",
      "--- 抜粋ここまで ---",
    ].join("\n");

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemContent },
            ...data.messages,
          ],
          max_completion_tokens: 1000,
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
