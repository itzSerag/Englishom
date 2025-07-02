# 🌱 Development Data Seeder

A comprehensive seeding system for the Englishom application that generates realistic development data for testing and frontend development.

## 📋 Overview

This seeder creates realistic data for:

- **Admins** - Super, Manager, Operator, and View role admins
- **Users** - Active, suspended, and blocked users with various countries
- **Courses** - All 6 language levels (A1-C2) with Arabic and English content
- **Orders** - Payment history with different statuses (completed, pending, failed)
- **OTPs** - Email verification and password reset tokens
- **Levels & Days** - Course structure with 50 days per level
- **Tasks** - Learning activities for each day
- **User Progress** - Realistic completion rates
- **User Tasks** - Individual task completions
- **Certifications** - Course completion certificates

## 🚀 Quick Start

### Auto-seeding on Server Start

The seeder automatically runs when the server starts in development mode (`NODE_ENV !== 'production'`).

### Manual Seeding via CLI

```bash
# Seed all development data
npm run seed

# Clear all seeded data (development only)
npm run seed:clear

# Seed specific data types
npm run seed:admins
npm run seed:users
npm run seed:courses
npm run seed:orders

# Show help
npm run seed:help
```

### Manual Seeding via API Endpoints

All endpoints require SUPER admin authentication:

```bash
# Get seeder status
GET /api/dev/seeder/status

# Seed all data
POST /api/dev/seeder/seed-all

# Seed specific data types
POST /api/dev/seeder/seed-admins
POST /api/dev/seeder/seed-users
POST /api/dev/seeder/seed-courses
POST /api/dev/seeder/seed-orders

# Clear all data (development only)
DELETE /api/dev/seeder/clear-all
```

## 📊 Generated Data

### 👑 Admins (4 accounts)

- **Super Admin**: `superadmin@englishom.com` / `SuperAdmin123!`
- **Manager**: `manager@englishom.com` / `Manager123!`
- **Operator**: `operator@englishom.com` / `Operator123!`
- **Viewer**: `viewer@englishom.com` / `Viewer123!`

### 👥 Users (56 accounts)

- **6 named users** with various statuses and verification states
- **50 generated users** with Arabic names and diverse activity patterns
- Countries: Egypt, Jordan, UAE, Saudi Arabia, Morocco, Lebanon, Tunisia, Algeria
- Statuses: Active (90%), Suspended (some), Blocked (few)
- Authentication strategies: Local, Google, Facebook

### 📚 Courses (6 levels)

Complete course catalog with:

- **A1**: Beginner - 199 EGP
- **A2**: Elementary - 249 EGP
- **B1**: Intermediate - 299 EGP
- **B2**: Upper-Intermediate - 349 EGP
- **C1**: Advanced - 399 EGP
- **C2**: Proficiency - 449 EGP

Each course includes Arabic and English titles/descriptions.

### 💳 Orders (20+ users)

Realistic order history with:

- **Completed orders** (most) - with payment IDs
- **Pending orders** (some) - payment in progress
- **Failed orders** (few) - payment failures
- Random amounts based on course prices
- Dates spread over the last 90 days

### 📅 Days & Tasks (300 days total)

- **50 days per level** (6 levels × 50 = 300 days)
- **3-7 tasks per day** from lesson types:
  - READ, PICTURES, LISTEN, Q_A, WRITE
  - SPEAK, GRAMMAR, DAILY_TEST, IDIOMS
  - PHRASAL_VERBS, TODAY

### 📈 User Progress

- **20-80% completion rate** per user per purchased level
- Realistic completion dates within the last 30 days
- Progress only for levels users have purchased

### ✅ User Task Completions

- **60-100% task completion** rate per completed day
- Completion timestamps match day completion dates

### 🏅 Certifications

- Generated for **30% of completed courses**
- Unique certificate IDs
- Linked to user and level

### 🔐 OTPs

- **Email verification OTPs** for unverified users
- **Password reset OTPs** for sample users
- 6-digit codes with proper expiration

## 🔧 Configuration

### Environment Requirements

- Seeding only runs in **non-production** environments
- Requires all database models to be properly configured
- MongoDB connection must be established

### Database Dependencies

The seeder requires these repositories:

- `AdminRepo`
- `UserRepo` (with access to Day, Task, UserProgress, UserTask models)
- `CourseRepo`
- `OrderRepo`
- `OtpRepo`
- `CertificateRepo`

## 🛠️ Development Usage

### For Frontend Development

```bash
# Start with fresh seeded data
npm run seed:clear
npm run seed:all
npm run start:dev
```

### For Testing Payment Systems

```bash
# Seed users and courses, then orders
npm run seed:users
npm run seed:courses
npm run seed:orders
```

### For Dashboard Analytics Testing

The seeder creates data perfect for testing dashboard analytics:

- User registration trends
- Course popularity statistics
- Payment completion rates
- User activity patterns
- Geographic distribution

## 📝 Data Relationships

The seeder maintains proper data relationships:

```
Users → Orders → User Progress → User Tasks
  ↓       ↓         ↓             ↓
Courses → Days → Tasks → Task Completions
  ↓
Certifications
```

- Users can only have progress for courses they've purchased
- Task completions only exist for completed days
- Certifications only generated for completed courses
- Geographic and temporal data follows realistic patterns

## 🚨 Security Notes

- **Production Safety**: Seeding is disabled in production environments
- **Admin Access**: API endpoints require SUPER admin authentication
- **Data Isolation**: Seeded data is clearly identifiable
- **Password Security**: All seeded passwords use bcrypt hashing

## 🔍 Troubleshooting

### Seeder Not Running

- Check `NODE_ENV` is not set to 'production'
- Verify database connection
- Ensure all required modules are imported

### Data Conflicts

- Clear existing data before re-seeding
- Check for unique constraint violations
- Verify model relationships are correct

### Permission Errors

- Ensure you're authenticated as SUPER admin for API endpoints
- Check guard configurations

## 🎯 Use Cases

✅ **Frontend Development** - Rich, realistic data for UI testing
✅ **API Testing** - Comprehensive data sets for endpoint testing  
✅ **Dashboard Analytics** - Statistical data for chart/graph testing
