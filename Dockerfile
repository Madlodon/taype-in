# Build de l'application
FROM oven/bun:1.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Dépendances de production seulement
FROM oven/bun:1.4 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Image finale
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY public ./public
COPY db ./db
COPY package.json next.config.ts ./
USER node
EXPOSE 3000
CMD ["sh", "-c", "node db/migrate.ts && node_modules/.bin/next start"]
