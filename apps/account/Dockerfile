FROM node:20-bookworm-slim AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

FROM deps AS builder

# Build-time placeholders let Next collect route data in a clean Docker context.
ENV MOAUTH_ACCOUNT_SESSION_SECRET=docker-build-account-session-secret
ENV MOAUTH_HANDOFF_INTERNAL_TOKEN=docker-build-handoff-token
ENV MOAUTH_HANDOFF_STORE_SECRET=docker-build-handoff-store-secret

ARG NEXT_PUBLIC_IDENTITY_PRODUCT_NAME=Aura
ARG NEXT_PUBLIC_IDENTITY_ACCOUNT_NAME="Aura 账号中心"
ARG NEXT_PUBLIC_IDENTITY_GATEWAY_NAME=Connect
ARG NEXT_PUBLIC_IDENTITY_CONNECT_URL=https://connect.example.com
ARG NEXT_PUBLIC_IDENTITY_SUPPORT_EMAIL=support@example.com
ARG NEXT_PUBLIC_IDENTITY_SLOGAN="入本源，见真知。"

ENV NEXT_PUBLIC_IDENTITY_PRODUCT_NAME=$NEXT_PUBLIC_IDENTITY_PRODUCT_NAME
ENV NEXT_PUBLIC_IDENTITY_ACCOUNT_NAME=$NEXT_PUBLIC_IDENTITY_ACCOUNT_NAME
ENV NEXT_PUBLIC_IDENTITY_GATEWAY_NAME=$NEXT_PUBLIC_IDENTITY_GATEWAY_NAME
ENV NEXT_PUBLIC_IDENTITY_CONNECT_URL=$NEXT_PUBLIC_IDENTITY_CONNECT_URL
ENV NEXT_PUBLIC_IDENTITY_SUPPORT_EMAIL=$NEXT_PUBLIC_IDENTITY_SUPPORT_EMAIL
ENV NEXT_PUBLIC_IDENTITY_SLOGAN=$NEXT_PUBLIC_IDENTITY_SLOGAN

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

CMD ["node", "server.mjs"]
