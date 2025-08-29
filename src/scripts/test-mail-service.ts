import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MailService } from '../common/mail/mail.service';
import { Logger } from '@nestjs/common';

async function testMailService() {
  const logger = new Logger('MailServiceTest');

  try {
    logger.log('🔍 Starting Mail Service diagnostics...');

    // Bootstrap the app to get access to services
    const app = await NestFactory.createApplicationContext(AppModule);
    const mailService = app.get(MailService);

    // Test 1: Check if service is initialized
    logger.log('✅ Mail service initialized successfully');

    // Test 2: Test API connection
    logger.log('🔗 Testing Brevo API connection...');
    const connectionTest = await mailService.testConnection();

    if (connectionTest) {
      logger.log('✅ Brevo API connection successful!');
    } else {
      logger.error('❌ Brevo API connection failed!');
    }

    // Test 3: Check environment variables
    logger.log('🔧 Checking environment variables...');
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
      logger.error('❌ BREVO_API_KEY is not set in environment variables');
    } else {
      const maskedKey =
        brevoApiKey.length > 10
          ? `${brevoApiKey.substring(0, 8)}...${brevoApiKey.substring(brevoApiKey.length - 6)}`
          : 'INVALID_LENGTH';
      logger.log(`✅ BREVO_API_KEY found: ${maskedKey}`);
      logger.log(`🔢 API Key length: ${brevoApiKey.length} characters`);

      // Check if it looks like a valid Brevo API key
      if (brevoApiKey.startsWith('xkeysib-')) {
        logger.log('✅ API Key format appears correct (starts with xkeysib-)');
      } else {
        logger.warn(
          '⚠️ API Key format may be incorrect (should start with xkeysib-)',
        );
      }
    }

    await app.close();
    logger.log('🏁 Mail Service diagnostics completed');
  } catch (error) {
    logger.error(
      `❌ Error during mail service test: ${error.message}`,
      error.stack,
    );
  }
}

// Run the test
testMailService()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
