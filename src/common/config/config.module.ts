import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { TimeService } from './time.service';
import { ConfigService } from './config.service';

@Module({
  providers: [TimeService, ConfigService],
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        // App Config
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),

        PORT: Joi.number().default(5000),
        BASE_URL: Joi.string().uri().required(),
        WEBSITE_URL: Joi.string().uri().required(),

        // Database
        DATABASE_URL: Joi.string().uri().required(),

        // JWT
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION_TIME: Joi.string().required(),

        // OAuth
        FACEBOOK_APP_ID: Joi.string().required(),
        FACEBOOK_APP_SECRET: Joi.string().required(),
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),

        // Local Storage
        LOCAL_STORAGE_PATH: Joi.string().default('./uploads'),
        LOCAL_STORAGE_URL: Joi.string()
          .uri()
          .default('http://localhost:3000/uploads'),

        // Paymob
        PAYMOB_API_KEY: Joi.string().required(),
        PAYMOB_INTEGRATION_ID: Joi.number().required(),
        PAYMOB_PUBLIC_KEY: Joi.string().required(),
        PAYMOB_SECRET_KEY: Joi.string().required(),
        PAYMOB_HMAC_SECRET: Joi.string().required(),

        // Brevo (formerly SendinBlue)
        BREVO_API_KEY: Joi.string().required(),
      }),
      validationOptions: {
        allowUnknown: true, // Allows env vars not specified in the schema
        abortEarly: false, // Reports all validation errors at once
      },
    }),
  ],
  exports: [NestConfigModule, TimeService],
})
export class ConfigModule {}
