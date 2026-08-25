# ============================================================
# Stage 1: Builder
# Install all deps (including devDeps) and compile TypeScript
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools required for native bindings (bcrypt, canvas, etc.)
RUN apk add --no-cache python3 make g++

# Copy manifests first to leverage Docker layer caching
COPY package*.json ./
COPY nest-cli.json ./
COPY tsconfig*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci 

# Copy source code
COPY src/ ./src/

# Compile TypeScript → JavaScript
RUN npm run build


# ============================================================
# Stage 2: Production Runner
# Only production deps + compiled dist — lean final image
# ============================================================
FROM node:22-alpine AS runner

LABEL maintainer="Englishom Team"
LABEL description="Englishom NestJS API — Production"

WORKDIR /app

# ffmpeg is required by fluent-ffmpeg at runtime
# dumb-init ensures proper PID-1 signal handling with PM2
RUN apk add --no-cache ffmpeg dumb-init

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy manifests for production install
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --frozen-lockfile && npm cache clean --force

# Copy compiled application from builder stage
COPY --from=builder /app/dist ./dist

# Copy PM2 ecosystem config
COPY ecosystem.config.js ./

# Create a writable directory for PM2 logs and @xenova/transformers model cache
RUN mkdir -p /app/logs /app/.cache && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose the NestJS application port
EXPOSE 3000

# Health check — polls the app's root API endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api || exit 1

# dumb-init as PID 1 → PM2 as process manager → NestJS cluster
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npx", "pm2-runtime", "ecosystem.config.js"]
