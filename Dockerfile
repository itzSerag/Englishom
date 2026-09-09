# ============================================================
# Stage 1: Build
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install native build dependencies (needed for bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Install all dependencies for building
COPY package*.json ./
RUN npm ci

# Copy source and build TypeScript to JavaScript
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
RUN npm run build

# Prune development dependencies
RUN npm prune --omit=dev && npm cache clean --force

# ============================================================
# Stage 2: Production Runtime
# ============================================================
FROM node:22-alpine

WORKDIR /app

# Install ffmpeg (audio processing) and dumb-init (PID 1 signal handling)
RUN apk add --no-cache ffmpeg dumb-init

# Prepare directories with permissions for built-in node user
RUN mkdir -p /app/.cache /app/logs && chown -R node:node /app

# Run as non-root user
USER node

# Copy production artifacts from builder
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/package.json ./package.json

# Production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV TRANSFORMERS_CACHE=/app/.cache

EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api || exit 1

# Start application via dumb-init for graceful shutdown
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main.js"]
