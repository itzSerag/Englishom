import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
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
        MONGODB_REPLICA_SET: Joi.string().default('rs0'),

        // JWT
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION_TIME: Joi.string().required(),

        // OAuth
        FACEBOOK_APP_ID: Joi.string().required(),
        FACEBOOK_APP_SECRET: Joi.string().required(),
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),

        // AWS
        AWS_ACCESS_KEY_ID: Joi.string().required(),
        AWS_SECRET_ACCESS_KEY: Joi.string().required(),
        AWS_REGION: Joi.string().required(),
        AWS_S3_BUCKET: Joi.string().required(),
        AWS_S3_BUCKET_RES: Joi.string().required(),

        // Email
        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().required(),
        SMTP_USER: Joi.string().required(),
        SMTP_PASS: Joi.string().required(),

        // Paymob
        PAYMOB_API_KEY: Joi.string().required(),
        PAYMOB_INTEGRATION_ID: Joi.number().required(),
        PAYMOB_PUBLIC_KEY: Joi.string().required(),
        PAYMOB_SECRET_KEY: Joi.string().required(),
        PAYMOB_HMAC_SECRET: Joi.string().required(),
      }),
      validationOptions: {
        allowUnknown: true, // Allows env vars not specified in the schema
        abortEarly: false, // Reports all validation errors at once
      },
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule { }