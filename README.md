# Englishom Backend API

Production backend service for the Englishom learning platform, built with NestJS and MongoDB. The system provides user authentication, course progression tracking, automated speech transcription via machine learning models, payment handling, and media management.

## Features

- Authentication and Authorization: JWT-based authentication supporting email/password, email OTP verification, and OAuth2 integration (Google and Facebook).
- Course Management: Structured course modules, level progression, and task completion tracking.
- Audio and Speech ML: In-container audio processing and transcription powered by Transformers.js (Whisper) and FFmpeg.
- Payment Integration: Paymob payment gateway integration with HMAC webhook validation.
- File and Media Storage: Hybrid storage supporting AWS S3 pre-signed URLs and MongoDB GridFS.
- Production Security: Helmet HTTP security headers, Throttler rate limiting, non-root container user execution, and graceful process shutdown.

## Tech Stack

- Runtime: Node.js 22
- Framework: NestJS 11
- Database: MongoDB with Mongoose ODM
- Speech Processing: @xenova/transformers, fluent-ffmpeg
- Cloud Storage: AWS S3 SDK v3
- Payments: Paymob API
- Containerization: Docker (multi-stage Alpine) and Docker Compose

## Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Docker and Docker Compose (v2 or higher)
- MongoDB instance (local or MongoDB Atlas)

## Environment Configuration

Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Description | Example / Default |
| --- | --- | --- |
| NODE_ENV | Application environment | `production` or `development` |
| PORT | HTTP server port | `3000` |
| HOST | Bind host address | `0.0.0.0` |
| DATABASE_URL | MongoDB connection string | `mongodb://mongodb:27017/Englishom` |
| JWT_SECRET | Secret key for user tokens | Secure random string (min 64 chars) |
| JWT_EXPIRATION_TIME | User token lifetime | `10d` |
| JWT_ADMIN_SECRET | Secret key for admin tokens | Secure random string (min 64 chars) |
| JWT_ADMIN_EXPIRATION_TIME | Admin token lifetime | `10d` |
| PAYMOB_API_KEY | Paymob API key | Paymob credential |
| PAYMOB_HMAC_SECRET | Paymob webhook HMAC key | Paymob HMAC secret |
| AWS_ACCESS_KEY_ID | AWS credentials | AWS Access Key |
| AWS_SECRET_ACCESS_KEY | AWS credentials | AWS Secret Key |
| AWS_REGION | S3 bucket region | `eu-central-1` |
| AWS_S3_BUCKET_NAME | Target S3 bucket name | S3 bucket identifier |
| BREVO_API_KEY | Brevo/Sendinblue API key | Transactional email key |

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start the development server with live reload:

```bash
npm run start:dev
```

3. Build the application for production:

```bash
npm run build
```

4. Run the production build locally:

```bash
npm run start:prod
```

## Production Deployment with Docker

### Method 1: Docker Compose (Recommended)

Docker Compose manages the application container, the MongoDB instance, and volume persistence for ML model caching and data storage.

1. Ensure `.env` is configured with your production secrets.

2. Start the application and database:

```bash
docker compose up -d
```

3. Check container status:

```bash
docker compose ps
```

4. View streaming application logs:

```bash
docker compose logs -f app
```

5. Stop all services:

```bash
docker compose down
```

#### Using an External Database (MongoDB Atlas)

If using MongoDB Atlas or an external database cluster:
1. Set `DATABASE_URL` in `.env` to your Atlas URI (`mongodb+srv://...`).
2. Start only the application service:

```bash
docker compose up -d app
```

#### Running with the Nginx Reverse Proxy

To run the application behind the bundled Nginx reverse proxy on port 80:

```bash
docker compose --profile proxy up -d
```

### Method 2: Standalone Docker Image

1. Build the production Docker image:

```bash
docker build -t englishom-api:latest .
```

2. Run the container:

```bash
docker run -d \
  --name englishom-api \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -v englishom_cache:/app/.cache \
  englishom-api:latest
```

## Health Checks and Process Management

- Health Check Endpoint: `GET /api`
  Returns HTTP 200 with an operational status string.
- Reverse Proxy Health Check: `GET /health` (routed to `/api`).
- Process Management: The container uses `dumb-init` as PID 1 to properly handle `SIGTERM` and `SIGINT` signals, ensuring clean connection draining and graceful application shutdown.
- Non-Root Security: The container runs under the unprivileged `node` user (UID 1000).

## API Endpoints Summary

### Authentication
- `POST /api/auth/signup`: User registration
- `POST /api/auth/login`: User login
- `POST /api/auth/verify-otp`: Account email verification
- `POST /api/auth/reset-password`: Password reset request
- `POST /api/auth/logout`: User session termination

### User Management
- `GET /api/users/me`: Current user profile
- `GET /api/users/all`: User list (Admin only)
- `POST /api/users/complete-day`: Mark learning day completed
- `POST /api/users/complete-task`: Mark task completed

### Courses
- `GET /api/courses`: List available courses
- `GET /api/courses/:id`: Course details and modules
- `POST /api/courses`: Create course (Admin only)

### File Upload and Speech Processing
- `POST /api/files`: Upload media files (GridFS or S3)
- `POST /api/files/transcribe`: Audio transcription with Whisper ML model
- `GET /api/files/:id`: Stream or download media file

### Payments
- `POST /api/payment/process-payment`: Create payment intention
- `POST /api/payment/callback`: Paymob webhook callback handler
- `POST /api/payment/refund`: Process refund (Admin only)

## License

This project is licensed under the MIT License.
