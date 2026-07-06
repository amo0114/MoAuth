FROM node:20-bookworm-slim AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

FROM deps AS builder

# Build-time placeholders let Next collect route data in a clean Docker context.
# The runner stage receives real production values from docker compose/runtime env.
ENV MOAUTH_ACCOUNT_SESSION_SECRET=docker-build-account-session-secret
ENV MOAUTH_HANDOFF_INTERNAL_TOKEN=docker-build-handoff-token
ENV MOAUTH_HANDOFF_STORE_SECRET=docker-build-handoff-store-secret

RUN npm --workspace @moauth/account run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3002

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/account ./apps/account

RUN mkdir -p /app/data && chown -R node:node /app

USER node
WORKDIR /app/apps/account

EXPOSE 3002

CMD ["../../node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3002"]
