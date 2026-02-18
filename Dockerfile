# Stage 1: Build
FROM node:20-alpine AS builder

# Increase memory for build
ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with speed optimizations
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copy source
COPY . .

# Build with verbose output for debugging
RUN npm run build

# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./

# Railway sets PORT dynamically — default to 8080 if not set
ARG PORT=8080
ENV PORT=${PORT}
EXPOSE ${PORT}

# Use npx to ensure tsx is available
CMD ["npx", "tsx", "server/index-simple.ts"]