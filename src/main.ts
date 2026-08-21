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
import helmet from 'helmet';

dotenv.config();

// Set global timezone to KSA (Asia/Riyadh)
process.env.TZ = 'Asia/Riyadh';

async function bootstrap() {
  const logger = new Logger('Server Main');

  try {
    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api');
    

    // Handle CORS at Nginx level for better security and performance
    // app.enableCors({
    //   origin: '*', 
    //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    // });

    app.use(helmet.crossOriginResourcePolicy({policy: "cross-origin"}));

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
    // On bare-metal: bind to 127.0.0.1 (Nginx proxies in externally).
    // Inside Docker: PM2 env_production sets HOST=0.0.0.0 so the app is
    // reachable from the Nginx container on the shared bridge network.
    const host = process.env.HOST ?? '127.0.0.1';

    await app.listen(port, host);

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
