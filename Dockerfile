FROM node:22-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-noto-cjk ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

COPY package*.json ./
RUN npm ci

FROM base AS build

ARG DATABASE_URL
ARG AUTH_SECRET
ARG AUTH_TRUST_HOST
ARG NEXT_PUBLIC_APP_URL
ARG OPENAI_API_KEY
ARG OPENAI_MODEL
ARG SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_AUTH_TOKEN
ARG NEXT_PUBLIC_POSTHOG_TOKEN
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST

ENV DATABASE_URL=$DATABASE_URL
ENV AUTH_SECRET=$AUTH_SECRET
ENV AUTH_TRUST_HOST=$AUTH_TRUST_HOST
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV OPENAI_MODEL=$OPENAI_MODEL
ENV SENTRY_DSN=$SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_POSTHOG_TOKEN=$NEXT_PUBLIC_POSTHOG_TOKEN
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

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
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "run", "start"]
