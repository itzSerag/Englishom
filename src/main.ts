import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { AllExceptionsFilter } from './common/filters/all-exception';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('Server Main');
  const app = await NestFactory.create(AppModule);

  // Security middleware
  app.use(helmet());

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    preflightContinue: false,
  });

  // Enhanced validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Request size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  await app.listen(process.env.PORT ?? 3000, () => {
    logger.log('Server started on port ' + (process.env.PORT ?? 3000));
  });
}
bootstrap();
