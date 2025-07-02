#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeederService } from '../common/seeds/seeder.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('SeederCLI');

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get the seeder service
    const seederService = app.get(SeederService);
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'seed-all';

    logger.log(`🌱 Running seeder command: ${command}`);

    switch (command) {
      case 'seed-all':
        await seederService.seedTestData();
        logger.log('✅ All data seeded successfully!');
        break;

      case 'clear':
        await seederService.clearAllData();
        logger.log('🗑️ All data cleared successfully!');
        break;

      case 'admins':
        await seederService['seedAdmins']();
        logger.log('👑 Admin data seeded successfully!');
        break;

      case 'users':
        await seederService['seedUsers']();
        logger.log('👥 User data seeded successfully!');
        break;

      case 'courses':
        await seederService['seedCourses']();
        logger.log('📚 Course data seeded successfully!');
        break;

      case 'orders':
        await seederService['seedOrders']();
        logger.log('💳 Order data seeded successfully!');
        break;

      case 'help':
        logger.log(`
🌱 Seeder CLI Commands:

  npm run seed              - Seed all development data
  npm run seed seed-all     - Seed all development data
  npm run seed clear        - Clear all seeded data
  npm run seed admins       - Seed only admin data
  npm run seed users        - Seed only user data
  npm run seed courses      - Seed only course data
  npm run seed orders       - Seed only order data
  npm run seed help         - Show this help message

Environment: ${process.env.NODE_ENV || 'development'}
        `);
        break;

      default:
        logger.error(`❌ Unknown command: ${command}`);
        logger.log('Run "npm run seed help" for available commands');
        process.exit(1);
    }

    // Close the application context
    await app.close();
    logger.log('🎉 Seeding completed successfully!');

  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeder
bootstrap();
