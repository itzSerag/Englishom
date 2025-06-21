const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');

let app;

module.exports = async (req, res) => {
  if (!app) {
    app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    
    // Enable CORS
    app.enableCors({
      origin: process.env.CORS_ORIGIN ?? '*',
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
    });

    await app.init();
  }

  return app.getHttpAdapter().getInstance()(req, res);
};
