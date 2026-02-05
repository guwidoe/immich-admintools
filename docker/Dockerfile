# Build stage
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install all dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/ ./apps/
COPY turbo.json ./

# Build both apps (turbo handles dependency order)
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config for production dependency install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built server (NestJS compiled output)
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Copy built web (SvelteKit static build)
COPY --from=builder /app/apps/web/build ./apps/web/build

# The server will serve the static frontend via @nestjs/serve-static
# WEB_DIR tells the server where to find the built frontend
ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIR=/app/apps/web/build

EXPOSE 3000

WORKDIR /app/apps/server

# Create data directory for persistent settings (mountable as volume)
RUN mkdir -p data
VOLUME /app/apps/server/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main.js"]
