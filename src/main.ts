import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import * as express from 'express';
import * as dotenv from 'dotenv';
import { AllExceptionsFilter } from './common/filters/all-exception';

dotenv.config();

// Set global timezone to KSA (Asia/Riyadh)
process.env.TZ = 'Asia/Riyadh';

async function bootstrap() {
  const logger = new Logger('Server Main');

  try {
    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api');
    const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];

    app.enableCors({
      origin: corsOrigins,
      credentials: true,
      methods: process.env.CORS_METHODS?.split(',') || [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'OPTIONS',
      ],
      allowedHeaders: process.env.CORS_HEADERS?.split(',') || [
        'Content-Type',
        'Authorization',
        'Accept',
      ],
      preflightContinue: false,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );

    app.use(express.json({ limit: '20mb' }));
    app.use(express.urlencoded({ extended: true, limit: '20mb' }));

    const port = process.env.PORT ?? 3000;

    // ON SERVER:
    // 127.0.0.1 run only locally for security reasons
    // 0.0.0.0 to run on all interfaces (less secure)

    await app.listen(port, '127.0.0.1');

    logger.log(`Server successfully started on port ${port} ${Date.now()}`);
  } catch (error) {
    logger.error(
      `Error during application bootstrap: ${error.message}`,
      error.stack,
    );
    process.exit(1);
  }
}

bootstrap();
