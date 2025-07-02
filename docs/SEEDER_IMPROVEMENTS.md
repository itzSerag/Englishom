# Seeder Service Improvements Summary

## Fixed Issues

### 1. Day Schema `_id` Error ✅

**Problem**: `Day validation failed: _id: Path '_id' is required.`

**Solution**:

- Changed from using `this.userRepo['dayModel'].create()` to manual creation
- Now using `new this.userRepo['dayModel'](dayData)` and `await day.save()`
- This lets MongoDB automatically generate the `_id` field

### 2. OTP Duplicate Key Error ✅

**Problem**: `E11000 duplicate key error collection: Englishom.otps index: email_1`

**Solutions**:

- Added `clearExistingOtps()` method that runs before OTP seeding
- Added try-catch blocks around OTP creation to handle duplicates gracefully
- Only clear test user OTPs to avoid affecting real users
- Added proper error handling that logs warnings instead of throwing errors

### 3. Level Seeding Implementation ✅

**Problem**: `Level seeding skipped - would need LevelRepo implementation`

**Solution**:

- Updated `UserRepo` to include `Level` model injection
- Added proper level seeding using `this.userRepo['levelModel']`
- Creates all 6 levels (A1, A2, B1, B2, C1, C2) with proper validation

## Quality Improvements

### Reduced Record Count for Better Quality

- **Users**: Reduced from 50 additional users to 15 (20 total users)
- **Days**: Reduced from 50 days per level to 10 days per level
- **Tasks**: Consistent 5-6 tasks per day (alternating pattern)

### Better Data Consistency

- More realistic user distribution across countries
- Better completion rates for user progress (20-80%)
- More consistent task completion patterns (60-100%)
- Proper date handling for activity timestamps

### Improved Error Handling

- All seeding methods now have proper try-catch blocks
- Non-critical errors (like OTP duplicates) don't break the entire seeding process
- Better logging with success/warning/error messages
- Graceful handling of missing dependencies

## Data Structure Created

### Admins (4 total)

- 1 Super Admin
- 1 Manager
- 1 Operator
- 1 Viewer

### Courses (6 total)

- All 6 levels (A1-C2) with Arabic/English titles and realistic pricing

### Levels (6 total)

- Proper Level documents for all course levels

### Users (20 total)

- 5 predefined test users with various statuses
- 15 generated users with realistic names and countries

### Days & Tasks (60 days, 330+ tasks)

- 10 days per level × 6 levels = 60 days
- 5-6 tasks per day = 330+ total tasks
- Tasks use real lesson types (READ, LISTEN, WRITE, etc.)

### Orders

- Realistic orders for first 20 users
- Mix of COMPLETED, PENDING, and FAILED statuses
- Proper payment IDs for completed orders

### User Progress & Task Completions

- Progress based on completed orders
- Realistic completion rates
- Proper date relationships

### Certifications

- 30% of completed orders get certificates
- Unique certificate IDs

### OTPs

- Email verification OTPs for unverified users
- Password reset OTPs for sample users
- Proper duplicate handling

## Usage

The seeder now runs automatically in development mode when the application starts. It can also be triggered manually via the API endpoints or CLI scripts.

All data is realistic and suitable for:

- Frontend development and testing
- Dashboard analytics
- User journey testing
- Payment flow testing
- Admin functionality testing
