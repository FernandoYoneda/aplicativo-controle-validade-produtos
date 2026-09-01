# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

FROM dependencies AS build

COPY apps/api apps/api

RUN npm run prisma:generate --workspace=api
RUN npm run build --workspace=api

FROM dependencies AS setup

COPY apps/api apps/api

RUN npm run prisma:generate --workspace=api

CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy --config prisma.config.ts && npm run prisma:seed"]

FROM dependencies AS production-dependencies

RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nestjs

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY --from=production-dependencies /app/node_modules node_modules
COPY --from=production-dependencies /app/apps/api/node_modules apps/api/node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist apps/api/dist
COPY --from=build --chown=nestjs:nodejs /app/apps/api/generated apps/api/generated

USER nestjs

EXPOSE 3001

CMD ["node", "apps/api/dist/src/main.js"]
