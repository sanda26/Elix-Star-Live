# Stage 1: Build
FROM node:20-alpine AS builder

ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build-time args: set these so the frontend is built with your Hetzner server URLs.
# Pass from docker-compose via build.args (values from .env on the server).
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_LIVEKIT_URL
ARG VITE_BUNNY_CDN_HOSTNAME
ARG VITE_GIFT_ASSET_BASE_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_LIVEKIT_URL=${VITE_LIVEKIT_URL}
ENV VITE_BUNNY_CDN_HOSTNAME=${VITE_BUNNY_CDN_HOSTNAME}
ENV VITE_GIFT_ASSET_BASE_URL=${VITE_GIFT_ASSET_BASE_URL}

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./

ARG PORT=8080
ENV PORT=${PORT}
ENV NODE_ENV=production
EXPOSE ${PORT}

CMD ["npx", "tsx", "server/index.ts"]
