import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Lovable AI Gateway: gemini supports built-in google_search grounding.
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const InputSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  prefecture: z.string().min(0).max(40).optional(),
  city: z.string().min(0).max(80).optional(),
  schedule: z.string().min(0).max(200).optional(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ResultSchema = z.object({
  startDate: isoDate,
  endDate: isoDate,
  source: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

export const refreshFestivalDate = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "LOVABLE_API_KEY not configured" };
    }

    const today = new Date().toISOString().slice(0, 10);
    const prompt = `あなたは日本のお祭り情報の専門リサーチャーです。Google検索を使い、以下のお祭りの「次回開催日」を公式情報から特定してください。

【お祭り】
- 名称: ${data.name}
- 場所: ${data.prefecture ?? ""} ${data.city ?? ""}
- 既知の開催時期メモ: ${data.schedule ?? "(なし)"}
- 今日: ${today}

【出力】
JSONのみを返してください。コードブロック禁止。
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "source": "参照URL or 出典",
  "confidence": "high"|"medium"|"low"
}

ルール:
- 必ず今日(${today})以降の直近の開催日を返す。
- 公式サイト/自治体/観光協会の情報を優先。
- 不明確な場合は最も信頼できる推定で、confidenceを下げる。
- 期間が1日の場合 startDate と endDate は同じ。`;

    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "厳密にJSONのみで応答してください。" },
            { role: "user", content: prompt },
          ],
          tools: [{ type: "google_search" }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("Gemini grounding error", res.status, errText);
        if (res.status === 429)
          return { ok: false as const, error: "リクエスト過多、しばらく待って再試行" };
        if (res.status === 402)
          return { ok: false as const, error: "AIクレジット切れ" };
        return { ok: false as const, error: `AI gateway error ${res.status}` };
      }

      const json = await res.json();
      const raw: string = json?.choices?.[0]?.message?.content ?? "";
      // Strip code fences if any
      const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
      // Extract first JSON object
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return { ok: false as const, error: "AI応答をパースできませんでした" };
      const parsed = ResultSchema.safeParse(JSON.parse(match[0]));
      if (!parsed.success)
        return { ok: false as const, error: "AI応答が想定外の形式でした" };

      return { ok: true as const, ...parsed.data };
    } catch (e) {
      console.error("refreshFestivalDate failed:", e);
      return { ok: false as const, error: "通信エラー" };
    }
  });
