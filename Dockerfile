# Multi-stage build for Azure Container Apps / App Service
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps
COPY package.json bun.lock* package-lock.json* ./
RUN npm install -g bun && bun install --frozen-lockfile || bun install

# Copy source and build for Node server (not Cloudflare)
COPY . .
ENV NITRO_PRESET=node-server
RUN bun run build

# ---- Runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Nitro node-server output lives in .output/
COPY --from=builder /app/.output ./.output

EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
