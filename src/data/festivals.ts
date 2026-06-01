// Festival schema. Data is loaded from /festivals.json (29,165 entries from Omamori DB).
export type Festival = {
  id: string;
  name: string;
  nameEn?: string;
  prefecture: string;
  city: string;
  startDate: string;
  endDate: string;
  category: "夏祭り" | "雪まつり" | "花火" | "神社祭礼" | "伝統芸能" | "踊り";
  difficulty: 1 | 2 | 3 | 4 | 5;
  xp: number;
  emoji: string;
  description: string;
  lat: number;
  lng: number;
  rank: "S" | "A" | "B" | "C";
  venue?: string;
  station?: string;
  tags?: string[];
  url?: string;
  schedule?: string;
};

export const CATEGORIES = [
  "すべて",
  "夏祭り",
  "雪まつり",
  "花火",
  "神社祭礼",
  "伝統芸能",
  "踊り",
] as const;

export type CategoryFilter = (typeof CATEGORIES)[number];
