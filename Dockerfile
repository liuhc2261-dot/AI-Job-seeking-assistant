FROM node:22-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-noto-cjk ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

COPY package*.json ./
RUN npm ci

FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run db:generate
RUN npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "run", "start"]
