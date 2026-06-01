# Azure デプロイ手順（Matsuri Quest）

Microsoft Agent Hackathon 2026 の必須要件「Azure 実行基盤」を満たすため、
**Azure Container Apps** にデプロイする最短手順。

## 前提
- Azure CLI インストール済み（`az --version`）
- Azure サブスクリプションあり
- このリポジトリをローカルに clone 済み

## 必要なシークレット
ビルド済みコンテナに渡す環境変数：

| 変数 | 値 |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | https://YOUR-RESOURCE.openai.azure.com |
| `AZURE_OPENAI_API_KEY`  | Azure OpenAI のキー |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-5.4-mini`（あなたのデプロイ名） |
| `AZURE_OPENAI_API_VERSION` | `2024-10-21` |

## ワンショット デプロイ

```bash
# 1. ログイン
az login

# 2. リソースグループ
az group create -n matsuri-quest-rg -l japaneast

# 3. Container Apps 環境とアプリを一発で作成（ローカル Dockerfile をビルド＆デプロイ）
az containerapp up \
  --name matsuri-quest \
  --resource-group matsuri-quest-rg \
  --location japaneast \
  --environment matsuri-quest-env \
  --source . \
  --ingress external \
  --target-port 8080 \
  --env-vars \
    AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com \
    AZURE_OPENAI_API_KEY=YOUR_KEY \
    AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini \
    AZURE_OPENAI_API_VERSION=2024-10-21
```

完了後、表示される `https://matsuri-quest.<random>.japaneast.azurecontainerapps.io`
が提出用 URL。

## 更新デプロイ

```bash
az containerapp up \
  --name matsuri-quest \
  --resource-group matsuri-quest-rg \
  --source .
```

## アーキテクチャ（提出記事用）

```
Browser
   │
   ▼
Azure Container Apps  ←─ 必須要件①（Azure 実行基盤）
   │  (TanStack Start SSR / Node)
   ├──► Azure OpenAI (gpt-5.4-mini)  ←─ 必須要件②（Microsoft AI）
   └──► お祭りDB (in-memory / src/data/festivals.ts)
```
