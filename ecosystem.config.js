'use strict';

/**
 * PM2 Ecosystem Configuration — Englishom NestJS API
 *
 * Inside Docker we use `pm2-runtime` (not `pm2 start`) so that:
 *   - PM2 runs as PID 1 (via dumb-init)
 *   - Logs stream to stdout/stderr instead of files
 *   - Container exit codes propagate correctly to Docker/Kubernetes
 *
 * @see https://pm2.keymetrics.io/docs/usage/docker-pm2-nodejs/
 */

const isProd = process.env.NODE_ENV === 'production';
const isDocker = process.env.RUNNING_IN_DOCKER === 'true';

module.exports = {
  apps: [
    {
      // ── Identity ────────────────────────────────────────────────
      name: 'englishom-api',
      script: 'dist/main.js',

      // ── Cluster mode ────────────────────────────────────────────
      // 'max' spawns one worker per logical CPU core.
      // Inside Docker set CPU limits in docker-compose to control this.
      instances: isProd ? 'max' : 1,
      exec_mode: isProd ? 'cluster' : 'fork',

      // ── Restart policy ──────────────────────────────────────────
      autorestart: true,
      watch: false,           // Never watch files in production
      max_restarts: 10,
      min_uptime: '5s',       // Must stay alive 5 s to count as a successful start
      restart_delay: 3000,    // Wait 3 s between restarts

      // ── Memory guard ────────────────────────────────────────────
      // Restart a worker if it exceeds 800 MB (adjust to your server RAM)
      max_memory_restart: '800M',

      // ── Logging ─────────────────────────────────────────────────
      // In Docker, stream logs to stdout/stderr so Docker captures them.
      // On bare-metal, write to files under /app/logs.
      out_file: isDocker ? '/dev/stdout' : './logs/out.log',
      error_file: isDocker ? '/dev/stderr' : './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,       // Merge cluster instance logs into one stream

      // ── Graceful shutdown ────────────────────────────────────────
      // Give NestJS 10 s to finish in-flight requests before killing
      kill_timeout: 10000,
      listen_timeout: 8000,   // Wait 8 s for the app to call listen()

      // ── Source map support ───────────────────────────────────────
      source_map_support: true,

      // ── Instance metadata ────────────────────────────────────────
      instance_var: 'INSTANCE_ID',

      // ── Environment variables ────────────────────────────────────
      // These are the DEFAULTS. Real secrets come from .env.production
      // (loaded via docker-compose env_file) — never hard-code secrets here.
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '127.0.0.1',
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',      // Must listen on all interfaces inside Docker
        RUNNING_IN_DOCKER: 'true',
      },
    },
  ],
};