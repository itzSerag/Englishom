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

    const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(origin => origin.trim()) || [];
  
  // LOG THIS - Very important for debugging
    console.log('🌐 CORS Origins configured:', corsOrigins);
    console.log('📝 CORS_ORIGIN from env:', process.env.CORS_ORIGIN);

    app.enableCors({
      origin: (origin, callback) => {
        console.log('🔍 Incoming origin:', origin);
        
        // Allow requests with no origin (like mobile apps, Postman, curl)
        if (!origin) {
          return callback(null, true);
        }
        
        if (corsOrigins.includes(origin)) {
          console.log('✅ Origin allowed:', origin);
          callback(null, true);
        } else {
          console.log('❌ Origin blocked:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      exposedHeaders: ['Set-Cookie'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
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
