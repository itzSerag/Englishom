import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';

// Repositories
import { AdminRepo } from '../../admin/repo/admin.repo';
import { UserRepo } from '../../user/repo/user.repo';
import { CourseRepo } from '../../course/repo/course.repo';
import { OrderRepo } from '../../payment/repo/order.repo';
import { OtpRepo } from '../../user-auth/repo/repo.otp';
import { CertificateRepo } from '../../user/repo/certificate.repo';

// Enums
import { AdminRole, Role, UserStatus } from '../shared';
import { OtpCause } from '../../user-auth/enum/otp-cause.enum';
import { PaymentStatus } from '../../payment/types';
import { LESSONS, Level_Name, Strategy } from '../shared/enums';
import { ClusterHelper } from '../services/cluster-helper.service';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);
  private readonly isDevelopment: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly adminRepo: AdminRepo,
    private readonly userRepo: UserRepo,
    private readonly courseRepo: CourseRepo,
    private readonly orderRepo: OrderRepo,
    private readonly otpRepo: OtpRepo,
    private readonly certificateRepo: CertificateRepo,
    // PREVENT SEED JOB INTERFERENCE
    private readonly clusterHelper: ClusterHelper,
  ) {
    this.isDevelopment = this.configService.get('NODE_ENV') !== 'production';
  }

  async onModuleInit() {

    // run seeds only on primary instance
    if (!this.clusterHelper.isPrimary()) {
      this.logger.log('Skipping SeederService on non-primary instance');
      return;
    }

    if (this.isDevelopment) {
      this.logger.log('🌱 Checking if development seeding is needed...');
      const needsSeeding = await this.checkIfSeedingNeeded();

      if (needsSeeding) {
        this.logger.log('🌱 Running development seeders...');
        await this.runAllSeeders();
        this.logger.log('✅ Development seeding completed!');
      } else {
        this.logger.log(
          'ℹ️ Database already has sufficient data, skipping seeding',
        );
        // Always ensure the super test user exists even if bulk seeding is skipped
        try {
          await this.seedSuperTestUser();
        } catch (err) {
          this.logger.warn('Failed ensuring super test user:', err?.message || err);
        }
      }
      
    }
  }

  private async checkIfSeedingNeeded(): Promise<boolean> {
    try {
      // Define minimum counts for each entity type
      const minCounts = {
        admins: 3, // At least 3 admins (super, manager, operator)
        courses: 6, // All 6 levels
        users: 10, // At least 10 users
        orders: 5, // At least 5 orders
        levels: 6, // All 6 levels
        days: 30, // At least 30 days across all levels (6 levels × 5 days minimum)
      };

      // Check each entity count
      const [
        adminCount,
        courseCount,
        userCount,
        orderCount,
        levelCount,
        dayCount,
      ] = await Promise.all([
        this.adminRepo.count(),
        this.courseRepo.count(),
        this.userRepo.count(),
        this.orderRepo.count(),
        this.userRepo['levelModel'].countDocuments(),
        this.userRepo['dayModel'].countDocuments(),
      ]);

      this.logger.log(`Current database counts:
        📝 Admins: ${adminCount}/${minCounts.admins}
        📚 Courses: ${courseCount}/${minCounts.courses}
        👥 Users: ${userCount}/${minCounts.users}
        💳 Orders: ${orderCount}/${minCounts.orders}
        🏆 Levels: ${levelCount}/${minCounts.levels}
        📅 Days: ${dayCount}/${minCounts.days}`);

      // Return true if any count is below minimum
      const needsSeeding =
        adminCount < minCounts.admins ||
        courseCount < minCounts.courses ||
        userCount < minCounts.users ||
        orderCount < minCounts.orders ||
        levelCount < minCounts.levels ||
        dayCount < minCounts.days;

      return needsSeeding;
    } catch (error) {
      this.logger.error('Error checking seeding requirements:', error);
      // If we can't check, assume we need seeding
      return true;
    }
  }

  private async runAllSeeders() {
    try {
      // Seed in order of dependencies with individual checks
      await this.seedAdmins();
      await this.seedCourses();
      await this.seedLevels();
      await this.seedUsers();
      await this.seedDaysAndTasks();
      await this.seedOrders();
      await this.seedUserProgress();
      await this.seedUserTasks();
      await this.seedCertifications();
      // Create a super test user with full access and progress
      await this.seedSuperTestUser();
      // Clear existing OTPs before seeding new ones to prevent duplicates
      await this.clearExistingOtps();
      await this.seedOtps();
    } catch (error) {
      this.logger.error('❌ Seeding failed:', error);
      throw error;
    }
  }

  private async checkEntityNeedsSeeding(
    entityName: string,
    currentCount: number,
    minCount: number,
  ): Promise<boolean> {
    if (currentCount >= minCount) {
      this.logger.log(
        `✅ ${entityName}: ${currentCount}/${minCount} - sufficient data exists, skipping`,
      );
      return false;
    }
    this.logger.log(
      `🔄 ${entityName}: ${currentCount}/${minCount} - needs seeding`,
    );
    return true;
  }

  private async clearExistingOtps() {
    try {
      // Only clear OTPs for test users to avoid affecting real users
      const testEmails = [
        'alice@example.com',
        'bob@example.com',
        'carol@example.com',
        'david@example.com',
        'eve@example.com',
      ];

      for (const email of testEmails) {
        await this.otpRepo.deleteMany({ email });
      }

      // Also clear OTPs for generated test users
      for (let i = 1; i <= 15; i++) {
        await this.otpRepo.deleteMany({ email: `user${i}@example.com` });
      }

      this.logger.log('Cleared existing test OTPs');
    } catch (error) {
      this.logger.warn('Error clearing existing OTPs:', error.message);
    }
  }

  private async seedAdmins() {
    this.logger.log('📝 Seeding Admins...');

    // Check if we need to seed admins
    const currentCount = await this.adminRepo.count();
    const needsSeeding = await this.checkEntityNeedsSeeding(
      'Admins',
      currentCount,
      3,
    );

    if (!needsSeeding) return;

    const admins = [
      {
        email: 'badr-admin@englishom.com',
        firstName: 'Super',
        lastName: 'Admin',
        password: await bcrypt.hash('123456789asd', 12),
        adminRole: AdminRole.SUPER,
        country: 'KSA',
        isActive: true,
        createdBy: null,
      },
      {
        email: 'superadmin@englishom.com',
        firstName: 'Super',
        lastName: 'Admin',
        password: await bcrypt.hash('SuperAdmin123!', 12),
        adminRole: AdminRole.SUPER,
        country: 'Egypt',
        isActive: true,
        createdBy: null,
      },
      {
        email: 'manager@englishom.com',
        firstName: 'John',
        lastName: 'Manager',
        password: await bcrypt.hash('Manager123!', 12),
        adminRole: AdminRole.MANAGER,
        country: 'Egypt',
        isActive: true,
      },
      {
        email: 'operator@englishom.com',
        firstName: 'Sarah',
        lastName: 'Operator',
        password: await bcrypt.hash('Operator123!', 12),
        adminRole: AdminRole.OPERATOR,
        country: 'Jordan',
        isActive: true,
      },
      {
        email: 'viewer@englishom.com',
        firstName: 'Mike',
        lastName: 'Viewer',
        password: await bcrypt.hash('Viewer123!', 12),
        adminRole: AdminRole.VIEW,
        country: 'UAE',
        isActive: true,
      },
    ];

    for (const adminData of admins) {
      const existing = await this.adminRepo.findOne({ email: adminData.email });
      if (!existing) {
        const admin = await this.adminRepo.create(adminData);

        // Set createdBy for non-super admins
        if (adminData.adminRole !== AdminRole.SUPER && admins[0]) {
          const superAdmin = await this.adminRepo.findOne({
            email: 'superadmin@englishom.com',
          });
          if (superAdmin) {
            adminData.createdBy = superAdmin._id;
            await this.adminRepo.findOneAndUpdate(
              { _id: admin._id },
              { createdBy: superAdmin._id },
            );
          }
        }

        this.logger.log(`Created admin: ${adminData.email}`);
      }
    }
  }

  private async seedCourses() {
    this.logger.log('📚 Seeding Courses...');

    // Check if we need to seed courses
    const currentCount = await this.courseRepo.count();
    const needsSeeding = await this.checkEntityNeedsSeeding(
      'Courses',
      currentCount,
      6,
    );

    if (!needsSeeding) return;

    const courses = [
      {
        level_name: Level_Name.LEVEL_A1,
        titleAr: 'المستوى الأساسي A1',
        titleEn: 'Beginner Level A1',
        descriptionAr: 'تعلم الأساسيات الأولى للغة الإنجليزية',
        descriptionEn: 'Learn the first basics of English language',
        price: 199,
        isAvailable: true,
      },
      {
        level_name: Level_Name.LEVEL_A2,
        titleAr: 'المستوى الأساسي A2',
        titleEn: 'Elementary Level A2',
        descriptionAr: 'تطوير المهارات الأساسية في اللغة الإنجليزية',
        descriptionEn: 'Develop basic skills in English language',
        price: 249,
        isAvailable: true,
      },
      {
        level_name: Level_Name.LEVEL_B1,
        titleAr: 'المستوى المتوسط B1',
        titleEn: 'Intermediate Level B1',
        descriptionAr: 'بناء الثقة في التواصل باللغة الإنجليزية',
        descriptionEn: 'Build confidence in English communication',
        price: 299,
        isAvailable: true,
      },
      {
        level_name: Level_Name.LEVEL_B2,
        titleAr: 'المستوى فوق المتوسط B2',
        titleEn: 'Upper-Intermediate Level B2',
        descriptionAr: 'إتقان المهارات المتقدمة في اللغة الإنجليزية',
        descriptionEn: 'Master advanced English language skills',
        price: 349,
        isAvailable: true,
      },
      {
        level_name: Level_Name.LEVEL_C1,
        titleAr: 'المستوى المتقدم C1',
        titleEn: 'Advanced Level C1',
        descriptionAr: 'الوصول إلى مستوى الطلاقة في اللغة الإنجليزية',
        descriptionEn: 'Reach fluency level in English language',
        price: 399,
        isAvailable: true,
      },
      {
        level_name: Level_Name.LEVEL_C2,
        titleAr: 'المستوى المتقن C2',
        titleEn: 'Proficiency Level C2',
        descriptionAr: 'إتقان كامل وشامل للغة الإنجليزية',
        descriptionEn: 'Complete and comprehensive mastery of English',
        price: 449,
        isAvailable: true,
      },
    ];

    for (const courseData of courses) {
      const existing = await this.courseRepo.findOne({
        level_name: courseData.level_name,
      });
      if (!existing) {
        await this.courseRepo.create(courseData);
        this.logger.log(`Created course: ${courseData.level_name}`);
      }
    }
  }

  private async seedLevels() {
    this.logger.log('🏆 Seeding Levels...');

    try {
      // Check if we need to seed levels
      const currentCount = await this.userRepo['levelModel'].countDocuments();
      const needsSeeding = await this.checkEntityNeedsSeeding(
        'Levels',
        currentCount,
        6,
      );

      if (!needsSeeding) return;

      const levelNames = Object.values(Level_Name);

      for (const levelName of levelNames) {
        // Check if level exists using UserRepo's levelModel
        const existingLevel = await this.userRepo['levelModel'].findOne({
          id_name: levelName,
        });
        if (!existingLevel) {
          // Create level using the levelModel with proper _id generation
          const levelData = {
            _id: new Types.ObjectId(),
            id_name: levelName,
          };

          const level = new this.userRepo['levelModel'](levelData);
          await level.save();

          this.logger.log(`Created level: ${levelName}`);
        }
      }

      this.logger.log('✅ Level seeding completed successfully');
    } catch (error) {
      this.logger.error('Error seeding levels:', error.message);
      this.logger.error('Stack:', error.stack);
    }
  }

  private async seedUsers() {
    this.logger.log('👥 Seeding Users...');

    // Check if we need to seed users
    const currentCount = await this.userRepo.count();
    const needsSeeding = await this.checkEntityNeedsSeeding(
      'Users',
      currentCount,
      10,
    );

    if (!needsSeeding) return;

    const users = [
      {
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Johnson',
        password: await bcrypt.hash('Password123!', 10),
        strategy: Strategy.LOCAL,
        isVerified: true,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        country: 'Egypt',
        lastActivity: new Date(),
      },
      {
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Smith',
        password: await bcrypt.hash('Password123!', 10),
        strategy: Strategy.LOCAL,
        isVerified: true,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        country: 'Jordan',
        lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      {
        email: 'carol@example.com',
        firstName: 'Carol',
        lastName: 'Williams',
        password: await bcrypt.hash('Password123!', 10),
        strategy: Strategy.LOCAL,
        isVerified: false,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        country: 'UAE',
        lastActivity: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      },
      {
        email: 'david@example.com',
        firstName: 'David',
        lastName: 'Brown',
        password: await bcrypt.hash('Password123!', 10),
        strategy: Strategy.LOCAL,
        isVerified: true,
        role: Role.USER,
        status: UserStatus.SUSPENDED,
        country: 'Saudi Arabia',
        lastActivity: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000), // 70 days ago
        suspendedAt: new Date(),
        suspensionReason: 'Inactive for more than 65 days',
      },
      {
        email: 'eve@example.com',
        firstName: 'Eve',
        lastName: 'Davis',
        password: await bcrypt.hash('Password123!', 10),
        strategy: Strategy.GOOGLE,
        isVerified: true,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        country: 'Morocco',
        lastActivity: new Date(),
      },
    ];

    // Add fewer but higher quality diverse users (reduced from 50 to 15)
    const additionalUsers = [];
    const countries = [
      'Egypt',
      'Jordan',
      'UAE',
      'Saudi Arabia',
      'Morocco',
      'Lebanon',
    ];
    const firstNames = [
      'Ahmed',
      'Fatima',
      'Omar',
      'Layla',
      'Hassan',
      'Aisha',
      'Youssef',
      'Zeinab',
    ];
    const lastNames = [
      'Al-Masri',
      'Al-Jordani',
      'Al-Emirati',
      'Al-Saudi',
      'Al-Maghribi',
      'Al-Lubnani',
    ];

    for (let i = 0; i < 15; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      const email = `user${i + 1}@example.com`;
      const isActive = Math.random() > 0.1; // 90% active
      const daysAgo = Math.floor(Math.random() * 100);

      additionalUsers.push({
        email,
        firstName,
        lastName,
        password: await bcrypt.hash('Password123!', 10),
        strategy: [Strategy.LOCAL, Strategy.GOOGLE, Strategy.FACEBOOK][
          Math.floor(Math.random() * 3)
        ],
        isVerified: Math.random() > 0.2, // 80% verified
        role: Role.USER,
        status: isActive
          ? UserStatus.ACTIVE
          : daysAgo > 65
            ? UserStatus.SUSPENDED
            : UserStatus.ACTIVE,
        country: countries[i % countries.length],
        lastActivity: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        ...(daysAgo > 65 && {
          suspendedAt: new Date(),
          suspensionReason: 'Automatically suspended due to inactivity',
        }),
      });
    }

    const allUsers = [...users, ...additionalUsers];

    for (const userData of allUsers) {
      const existing = await this.userRepo.findOne({ email: userData.email });
      if (!existing) {
        await this.userRepo.create(userData);
        this.logger.log(`Created user: ${userData.email}`);
      }
    }
  }

  private async seedDaysAndTasks() {
    this.logger.log('📅 Seeding Days and Tasks...');

    // Check if we need to seed days
    const currentCount = await this.userRepo['dayModel'].countDocuments();
    const needsSeeding = await this.checkEntityNeedsSeeding(
      'Days',
      currentCount,
      30,
    );

    if (!needsSeeding) return;

    // Access day and task models through UserRepo
    const levelNames = Object.values(Level_Name);
    const lessons = Object.values(LESSONS);

    try {
      for (const levelName of levelNames) {
        // Create only 10 days for each level (reduced from 50 for better quality)
        for (let dayNumber = 1; dayNumber <= 10; dayNumber++) {
          // Check if day exists using UserRepo's dayModel
          const existingDay = await this.userRepo['dayModel'].findOne({
            levelName,
            dayNumber,
          });

          if (!existingDay) {
            // Create day with proper _id generation (Day extends AbstractDocument)
            const dayData = {
              _id: new Types.ObjectId(),
              dayNumber,
              levelName,
            };

            const day = new this.userRepo['dayModel'](dayData);
            await day.save();

            // Create 5-6 quality tasks for this day (reduced but more consistent)
            const numberOfTasks = 5 + (dayNumber % 2); // Alternates between 5 and 6 tasks
            const selectedLessons = lessons.slice(0, numberOfTasks);

            for (const lesson of selectedLessons) {
              const taskExists = await this.userRepo['taskModel'].findOne({
                dayId: day._id,
                name: lesson,
              });

              if (!taskExists) {
                const taskData = {
                  name: lesson,
                  description: `Complete ${lesson.toLowerCase().replace('_', ' ')} activity for day ${dayNumber} - ${levelName}`,
                  dayId: day._id,
                };

                const task = new this.userRepo['taskModel'](taskData);
                await task.save();
              }
            }

            this.logger.log(
              `Created day ${dayNumber} for ${levelName} with ${selectedLessons.length} tasks`,
            );
          }
        }
      }

      this.logger.log('✅ Days and Tasks seeding completed successfully');
    } catch (error) {
      this.logger.error('Error seeding days and tasks:', error.message);
      this.logger.error('Stack:', error.stack);
    }
  }

  private async seedOrders() {
    this.logger.log('💳 Seeding Orders...');

    // Check if we need to seed orders
    const currentCount = await this.orderRepo.count();
    const needsSeeding = await this.checkEntityNeedsSeeding(
      'Orders',
      currentCount,
      5,
    );

    if (!needsSeeding) return;

    // Get some users and courses to create realistic orders
    const users = await this.userRepo.find({});
    const courses = await this.courseRepo.find({});

    if (!users || !courses) {
      this.logger.warn('No users or courses found for order seeding');
      return;
    }

    const orderStatuses = [
      PaymentStatus.COMPLETED,
      PaymentStatus.PENDING,
      PaymentStatus.FAILED,
    ];
    const levelNames = Object.values(Level_Name);

    // Create orders for first 20 users
    for (let i = 0; i < Math.min(20, users.length); i++) {
      const user = users[i];
      const numOrders = Math.floor(Math.random() * 3) + 1; // 1-3 orders per user

      for (let j = 0; j < numOrders; j++) {
        const course = courses[Math.floor(Math.random() * courses.length)];
        const status =
          orderStatuses[Math.floor(Math.random() * orderStatuses.length)];

        // Generate a payment date within the current calendar year
        const now = new Date();
        const daysAgo = Math.floor(Math.random() * 90); // up to ~3 months back
        const paymentDate = new Date(
          now.getTime() - daysAgo * 24 * 60 * 60 * 1000,
        );
        if (paymentDate.getFullYear() < now.getFullYear()) {
          // Clamp to current year so test data stays in the active year
          paymentDate.setFullYear(now.getFullYear());
        }
        const orderData = {
          userId: user._id as any, // Type assertion for ObjectId compatibility
          levelName: course.level_name,
          amount: course.price, // Use whole currency amount directly
          paymentStatus: status,
          paymentDate,
          ...(status === PaymentStatus.COMPLETED && {
            paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          }),
        };

        const existing = await this.orderRepo.findOne({
          userId: user._id,
          levelName: course.level_name,
        });

        if (!existing) {
          await this.orderRepo.create(orderData);
          this.logger.log(
            `Created order for user ${user.email} - ${course.level_name}`,
          );
        }
      }
    }
  }

  private async seedUserProgress() {
    this.logger.log('📈 Seeding User Progress...');

    try {
      // Check if we need to seed user progress
      const currentCount =
        await this.userRepo['userProgressModel'].countDocuments();
      const needsSeeding = await this.checkEntityNeedsSeeding(
        'User Progress',
        currentCount,
        20,
      );

      if (!needsSeeding) return;

      // Get users and their completed orders to generate realistic progress
      const users = await this.userRepo.find({});
      const completedOrders = await this.orderRepo.find({
        paymentStatus: PaymentStatus.COMPLETED,
      });

      if (!users || !completedOrders) {
        this.logger.warn(
          'No users or completed orders found for progress seeding',
        );
        return;
      }

      for (const order of completedOrders) {
        const user = users.find(
          (u) => u._id.toString() === order.userId.toString(),
        );
        if (!user) continue;

        // Get days for this level
        const days = await this.userRepo['dayModel'].find({
          levelName: order.levelName,
        });

        if (!days || days.length === 0) continue;

        // Complete random number of days (20-80% of total days)
        const completionRate = 0.2 + Math.random() * 0.6; // 20-80%
        const daysToComplete = Math.floor(days.length * completionRate);

        for (let i = 0; i < daysToComplete; i++) {
          const day = days[i];
          const existingProgress = await this.userRepo[
            'userProgressModel'
          ].findOne({
            userId: user._id,
            dayId: day._id,
          });

          if (!existingProgress) {
            await this.userRepo['userProgressModel'].create({
              userId: user._id,
              dayId: day._id,
              completed: true,
              completedAt: new Date(
                Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
              ), // Random date within last 30 days
            });
          }
        }

        this.logger.log(
          `Created progress for user ${user.email} - ${order.levelName}: ${daysToComplete}/${days.length} days`,
        );
      }
    } catch (error) {
      this.logger.error('Error seeding user progress:', error.message);
    }
  }

  private async seedUserTasks() {
    this.logger.log('✅ Seeding User Tasks...');

    try {
      // Check if we need to seed user tasks
      const currentCount =
        await this.userRepo['userTaskModel'].countDocuments();
      const needsSeeding = await this.checkEntityNeedsSeeding(
        'User Tasks',
        currentCount,
        50,
      );

      if (!needsSeeding) return;

      // Get user progress to generate task completions
      const userProgress = await this.userRepo['userProgressModel']
        .find({
          completed: true,
        })
        .populate('dayId');

      if (!userProgress || userProgress.length === 0) {
        this.logger.warn('No user progress found for task seeding');
        return;
      }

      for (const progress of userProgress) {
        if (!progress.dayId) continue;

        // Get tasks for this day
        const tasks = await this.userRepo['taskModel'].find({
          dayId: progress.dayId._id,
        });

        if (!tasks || tasks.length === 0) continue;

        // Complete random percentage of tasks (60-100%)
        const completionRate = 0.6 + Math.random() * 0.4; // 60-100%
        const tasksToComplete = Math.floor(tasks.length * completionRate);

        for (let i = 0; i < tasksToComplete; i++) {
          const task = tasks[i];
          const existingUserTask = await this.userRepo['userTaskModel'].findOne(
            {
              userId: progress.userId,
              taskId: task._id,
            },
          );

          if (!existingUserTask) {
            await this.userRepo['userTaskModel'].create({
              userId: progress.userId,
              taskId: task._id,
              completed: true,
              completedAt: new Date(
                progress.completedAt.getTime() +
                  Math.random() * 24 * 60 * 60 * 1000,
              ), // Same day as progress completion
            });
          }
        }

        this.logger.log(
          `Created task completions: ${tasksToComplete}/${tasks.length} tasks for day ${progress.dayId.dayNumber}`,
        );
      }
    } catch (error) {
      this.logger.error('Error seeding user tasks:', error.message);
    }
  }

  private async seedCertifications() {
    this.logger.log('🏅 Seeding Certifications...');

    // Check if we need to seed certifications
    const currentCount = await this.certificateRepo.count();
    const needsSeeding = await this.checkEntityNeedsSeeding(
      'Certifications',
      currentCount,
      3,
    );

    if (!needsSeeding) return;

    // Get users who have completed courses
    const completedOrders = await this.orderRepo.find({
      paymentStatus: PaymentStatus.COMPLETED,
    });

    if (!completedOrders || completedOrders.length === 0) {
      this.logger.warn('No completed orders found for certification seeding');
      return;
    }

    // Create certifications for 30% of completed orders
    for (const order of completedOrders) {
      if (Math.random() < 0.3) {
        // 30% chance
        const certificationData = {
          userId: order.userId as any, // Type assertion for ObjectId compatibility
          certificateId: `CERT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          level_name: order.levelName,
        };

        const existing = await this.certificateRepo.findOne({
          userId: order.userId,
          level_name: order.levelName,
        });

        if (!existing) {
          await this.certificateRepo.create(certificationData);
          this.logger.log(
            `Created certification for level: ${order.levelName}`,
          );
        }
      }
    }
  }

  private async seedOtps() {
    this.logger.log('🔐 Seeding OTPs...');

    try {
      // Check if we need to seed OTPs (using model directly since OtpRepo doesn't extend AbstractRepo)
      const currentCount = await this.otpRepo['otpModel'].countDocuments();
      const needsSeeding = await this.checkEntityNeedsSeeding(
        'OTPs',
        currentCount,
        5,
      );

      if (!needsSeeding) return;

      // Get some unverified users
      const unverifiedUsers = await this.userRepo.find({ isVerified: false });

      if (!unverifiedUsers || unverifiedUsers.length === 0) {
        this.logger.warn('No unverified users found for OTP seeding');
        return;
      }

      for (const user of unverifiedUsers.slice(0, 5)) {
        // First 5 unverified users
        const existing = await this.otpRepo.findOne({
          email: user.email,
          cause: OtpCause.EMAIL_VERIFICATION,
        });

        if (!existing) {
          const otpData = {
            email: user.email,
            otp: Math.floor(100000 + Math.random() * 900000).toString(), // 6-digit OTP
            cause: OtpCause.EMAIL_VERIFICATION,
          };

          try {
            await this.otpRepo.create(otpData);
            this.logger.log(`Created OTP for user: ${user.email}`);
          } catch (error) {
            if (error.code === 11000) {
              this.logger.warn(`OTP already exists for user: ${user.email}`);
            } else {
              throw error;
            }
          }
        }
      }

      // Create some password reset OTPs
      const users = await this.userRepo.find({});
      for (const user of users.slice(0, 3)) {
        // First 3 users
        const existing = await this.otpRepo.findOne({
          email: user.email,
          cause: OtpCause.FORGET_PASSWORD,
        });

        if (!existing) {
          const otpData = {
            email: user.email,
            otp: Math.floor(100000 + Math.random() * 900000).toString(),
            cause: OtpCause.FORGET_PASSWORD,
          };

          try {
            await this.otpRepo.create(otpData);
            this.logger.log(
              `Created password reset OTP for user: ${user.email}`,
            );
          } catch (error) {
            if (error.code === 11000) {
              this.logger.warn(
                `Password reset OTP already exists for user: ${user.email}`,
              );
            } else {
              throw error;
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error seeding OTPs:', error.message);
      // Don't re-throw to avoid breaking the entire seeding process
    }
  }

  // Manual seeding methods for testing
  async seedTestData() {
    this.logger.log('🧪 Running manual test data seeding...');
    await this.runAllSeeders();
  }

  async clearAllData() {
    if (!this.isDevelopment) {
      throw new Error(
        'Data clearing is only allowed in development environment',
      );
    }

    this.logger.warn('🗑️ Clearing all seeded data...');

    // Clear in reverse order to handle dependencies
    await this.otpRepo.deleteMany({});
    // For AbstractRepo-based repos, we need to use different approach
    // Note: These would need custom delete methods in each repo
    this.logger.log(
      '✅ Data clearing would need custom implementation for each repo',
    );
  }

  /**
   * Seed a dedicated super test user who owns all levels and completed all 50 days in each level.
   * Email: supertestuser@gmail.com
   */
  async seedSuperTestUser() {
    try {
      const email = 'supertestuser@gmail.com';
      const passwordHash = await bcrypt.hash('Password123!', 10);

      // 1) Ensure user exists
      let user = await this.userRepo.findOne({ email });
      if (!user) {
        user = await this.userRepo.create({
          email,
          firstName: 'Super',
          lastName: 'TestUser',
          password: passwordHash,
          isVerified: true,
          role: Role.USER,
          status: UserStatus.ACTIVE,
          strategy: Strategy.LOCAL,
          country: 'Egypt',
          lastActivity: new Date(),
        } as any);
        this.logger.log(`👤 Created super test user: ${email}`);
      } else {
        this.logger.log(`👤 Super test user already exists: ${email}`);
      }

      // 2) Ensure 50 days exist for every level
      const levelNames = Object.values(Level_Name);
      for (const levelName of levelNames) {
        for (let dayNumber = 1; dayNumber <= 50; dayNumber++) {
          const existingDay = await this.userRepo['dayModel'].findOne({
            levelName,
            dayNumber,
          });
          if (!existingDay) {
            const dayData = {
              _id: new Types.ObjectId(),
              dayNumber,
              levelName,
            };
            const day = new this.userRepo['dayModel'](dayData);
            await day.save();
          }
        }
      }
      this.logger.log('📅 Ensured 50 days exist for all levels');

      // 3) Ensure completed orders for all levels
      const courses = await this.courseRepo.find({});
      for (const course of courses) {
        const existingOrder = await this.orderRepo.findOne({
          userId: user._id,
          levelName: course.level_name,
        });
        if (!existingOrder) {
          await this.orderRepo.create({
            userId: user._id as any,
            levelName: course.level_name,
            amount: course.price,
            paymentStatus: PaymentStatus.COMPLETED,
            paymentDate: new Date(),
            paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          } as any);
        }
      }
      this.logger.log('💳 Ensured completed orders for all levels');

      // 4) Mark all 50 days completed in each level for this user
      for (const levelName of levelNames) {
        const days = await this.userRepo['dayModel']
          .find({ levelName })
          .select('_id dayNumber')
          .sort({ dayNumber: 1 });
        for (const day of days) {
          await this.userRepo['userProgressModel'].updateOne(
            { userId: user._id, dayId: day._id },
            {
              $set: {
                completed: true,
                completedAt: new Date(),
              },
            },
            { upsert: true },
          );
        }
      }
      this.logger.log('📈 Marked all 50 days as completed for super test user');

      // 5) Issue certificates for all levels
      for (const levelName of levelNames) {
        const existingCert = await this.certificateRepo.findOne({
          userId: user._id,
          level_name: levelName,
        });
        if (!existingCert) {
          await this.certificateRepo.create({
            userId: user._id as any,
            level_name: levelName,
            certificateId: `CERT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          } as any);
        }
      }
      this.logger.log('🏅 Issued certificates for all levels for super test user');

      this.logger.log('✅ Super test user seeding completed');
      return { email, userId: user._id };
    } catch (error) {
      this.logger.error('Error seeding super test user:', error.message);
      throw error;
    }
  }
}
