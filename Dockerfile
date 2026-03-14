# Elix Star Live — production build and run
# Uses npm install (not npm ci) so deploy works when lockfile is out of sync.

FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install deps with npm install so lockfile sync is not required
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Production image
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package files and install deps (include tsx to run server/index.ts)
COPY package.json package-lock.json* ./
RUN npm install

# Copy built frontend and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/tsconfig.server.json ./

EXPOSE 8080

CMD ["npx", "tsx", "server/index.ts"]
