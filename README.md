# Matsuri Quest 🏮

**日本のお祭り攻略マップ — 全国29,165件のお祭りをゲーミフィケーションで楽しむイベント管理アプリ**

> Microsoft Agent Hackathon 2026 提出作品

## 🎯 概要

「日本中のお祭り・伝統行事を“クエスト”として制覇していく」というコンセプトで、四季と土地の物語を旅するゲーミフィケーション・イベント管理アプリです。

### データソース
[Omamori Guardian Project (Yasuhito Yanagisawa)](https://github.com/YasuhitoYanagisawa/omamori-guardian) の **29,165件** の全国お祭りDBをフル活用。

## ✨ 主な機能

### 1. 🎮 ゲーミフィケーション
- お祭りに **Rank (S/A/B/C)**、**XP**、**難易度** を自動付与
- 制覇するとXP獲得、レベルアップ
- 「Next Quest」で次に行くべきSランク祭を提案
- 進捗・達成率の可視化

### 2. 📍 GPS位置情報による近隣検索
- ブラウザの Geolocation API で現在地を取得
- ハーバサイン距離計算で「近い順」ソート
- カードに距離(km)バッジ表示

### 3. 🗺 インタラクティブマップ
- Leaflet + OpenStreetMap (CartoDB Dark) で全国マップ
- **都道府県ごとの総XPヒートマップ** (oklch カラーランプ)
- ランク別カラーマーカー（S=金、A=赤、B=青、C=灰）
- 現在地ピン、近隣Top15リスト

### 4. 🔍 Gemini Grounding による日程の精度向上
- 各お祭りの詳細シートに「最新日程を取得」ボタン
- **Lovable AI Gateway (Google Gemini)** をサーバ関数で呼び出し
- 公式情報を Web 検索 (Grounding) し、JSON で `startDate`/`endDate` を返却
- localStorage に上書き保存 → 再表示時に反映

### 5. 💬 祭りAIガイド
- Azure OpenAI ベースの右下チャット
- 「夏におすすめの祭りは?」など自由質問に答える

## 🛠 技術スタック

- **Framework**: TanStack Start v1 (React 19, Vite 7, SSR-ready)
- **Styling**: Tailwind CSS v4 + カスタム和テーマ (washi-texture, lantern glow)
- **Data Fetching**: TanStack Query
- **Map**: Leaflet + react-leaflet
- **AI**:
  - Azure OpenAI (gpt-5.4-mini) — チャット
  - Lovable AI Gateway / Google Gemini-3 Flash — Grounding 日程更新
- **Server Functions**: `createServerFn` (TanStack Start)
- **Deploy**: Cloudflare Workers / Dockerfile (Azure App Service 対応)

## 📂 主要ファイル

```
src/
├── routes/
│   ├── index.tsx          # メイン (クエスト一覧、GPS、ランキング)
│   └── map.tsx            # 地図ビュー
├── components/
│   ├── FestivalMap.tsx    # Leaflet マップ + ヒートマップ
│   └── MatsuriAIChat.tsx  # 祭りAIチャット
├── hooks/
│   ├── use-festivals.ts   # 29k件DB取得 (TanStack Query)
│   └── use-geo.ts         # Geolocation
├── lib/
│   ├── game.ts            # XP/Level/制覇ロジック
│   ├── geo.ts             # 距離/ヒートカラー
│   ├── overrides.ts       # Gemini更新の localStorage 永続化
│   └── api/
│       ├── chat.functions.ts     # Azure OpenAI チャット
│       └── refresh.functions.ts  # Gemini Grounding
└── data/festivals.ts      # スキーマ

public/festivals.json      # 前処理済 29,165件 (Omamori DB)
```

## 🚀 開発

```bash
bun install
bun run dev       # http://localhost:8080
bun run build
```

## 📝 提出要件チェック

- ✅ Microsoft Azure OpenAI 利用 (チャット)
- ✅ Gemini Grounding でリアルタイム情報取得
- ✅ 29,165件の大規模OSSデータベース活用
- ✅ GPS / 地図 / ゲーミフィケーション の三本柱
- ✅ Dockerfile による Azure App Service デプロイ対応 (`AZURE_DEPLOY.md`)
- ✅ レスポンシブUI (デスクトップ/タブレット/モバイル)

## 🙏 クレジット

- お祭りDB: [omamori-guardian](https://github.com/YasuhitoYanagisawa/omamori-guardian)
- 地図タイル: © OpenStreetMap, © CartoDB
