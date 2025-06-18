# Admin System Quick Start Guide

## 🚀 Getting Started

The admin system has been successfully integrated into your Englishom application with minimal changes to your existing codebase.

### 🏁 What Was Created

#### 1. **New Admin Module** (`/src/admin/`)

- Completely separate from user module
- Role-based access control system
- Four admin roles: SUPER, MANAGER, OPERATOR, VIEW

#### 2. **Admin Roles & Permissions**

| Role         | Description               | Permissions                                                                                  |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------- |
| **SUPER**    | Full system access        | • Create/manage admins<br>• Manage users<br>• Full content management<br>• Cannot be deleted |
| **MANAGER**  | User & content management | • Manage users<br>• Full content management<br>• View other admins                           |
| **OPERATOR** | Content management only   | • Create/edit content<br>• View content                                                      |
| **VIEW**     | Read-only access          | • View content only                                                                          |

#### 3. **API Endpoints Added**

**Admin Authentication:**

- `POST /admin/login` - Admin login

**Admin Management:**

- `POST /admin/create` - Create admin (SUPER only)
- `GET /admin/all` - List admins (SUPER/MANAGER)
- `GET /admin/profile` - Get own profile
- `PATCH /admin/:id` - Update admin
6- `DELETE /admin/:id` - Delete admin (SUPER only)

**User Management (via Admin):**

- `GET /admin/users` - List users (MANAGER+)
- `GET /admin/users/:id` - Get user (MANAGER+)
- `PATCH /admin/users/:id` - Update user (MANAGER+)
- `DELETE /admin/users/:id` - Delete user (SUPER only)

**Content Management (via Admin):**

- `POST /admin/content/courses` - Create course (OPERATOR+)
- `GET /admin/content/courses` - List courses (All roles)
- `PATCH /admin/content/courses/:level_name` - Update course (OPERATOR+)

### 🔐 Initial Super Admin

The system automatically creates an initial SUPER admin on first startup:

```
Email: superadmin@englishom.com
Password: SuperAdmin123!
```

**⚠️ IMPORTANT: Change this password immediately after first login!**

### 🧪 Testing the System

1. **Start your application:**

   ```bash
   npm run start:dev
   ```

2. **Run the automated test:**

   ```bash
   ./test-admin-system.sh
   ```

3. **Manual testing with curl:**

   ```bash
   # Login as super admin
   curl -X POST http://localhost:3000/admin/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "superadmin@englishom.com",
       "password": "SuperAdmin123!"
     }'

   # Use the returned token for subsequent requests
   curl -X GET http://localhost:3000/admin/profile \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

### 🔄 What Changed in Existing Code

**Minimal changes were made to maintain backward compatibility:**

1. **Role Enum Updated** (`/src/common/shared/enums/role.enum.ts`)

   - Separated user roles from admin roles
   - Added new `AdminRole` enum

2. **JWT Strategy Enhanced** (`/src/auth/strategy/jwt.strategy.ts`)

   - Now handles both user and admin tokens
   - Added `type` field to distinguish token types

3. **Admin Guard Updated** (`/src/auth/guards/admin.guard.ts`)

   - Maintained backward compatibility
   - Now recognizes new admin roles

4. **App Module Updated** (`/src/app.module.ts`)
   - Added `AdminModule` import

### 🛡️ Security Features

- **JWT-based authentication** with separate admin tokens
- **Bcrypt password hashing**
- **Activity tracking** for admins
- **Protection mechanisms:**
  - Cannot delete the last SUPER admin
  - Cannot delete yourself
  - Role-based access control
- **Input validation** on all endpoints
- **Rate limiting** through existing throttler

### 🔧 Database Schema

New `Admin` collection with fields:

- `email` (unique)
- `firstName`, `lastName`
- `password` (hashed)
- `role` (AdminRole enum)
- `isActive` (soft delete flag)
- `isVerified`
- `lastActivity`, `lastLoginAt`
- `createdBy` (tracks who created the admin)

### 📝 Usage Examples

#### Create a Manager Admin

```bash
curl -X POST http://localhost:3000/admin/create \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@company.com",
    "firstName": "John",
    "lastName": "Manager",
    "password": "SecurePass123!",
    "role": "manager"
  }'
```

#### Manage Users as Admin

```bash
# Get all users
curl -X GET http://localhost:3000/admin/users \
  -H "Authorization: Bearer MANAGER_TOKEN"

# Update a user
curl -X PATCH http://localhost:3000/admin/users/USER_ID \
  -H "Authorization: Bearer MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Updated Name"}'
```

#### Content Management

```bash
# Create a course
curl -X POST http://localhost:3000/admin/content/courses \
  -H "Authorization: Bearer OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "level_name": "BEGINNER",
    "titleAr": "المستوى المبتدئ",
    "titleEn": "Beginner Level",
    "descriptionAr": "وصف المستوى المبتدئ",
    "descriptionEn": "Beginner level description",
    "price": 100
  }'
```

### 🚨 Important Notes

1. **Password Security**: Always use strong passwords for admin accounts
2. **Token Management**: Admin tokens should be rotated regularly
3. **Monitoring**: Track admin activities through the `lastActivity` field
4. **Backup**: Ensure the `Admin` collection is included in your backups
5. **Environment**: Never use default credentials in production

### 🔍 Troubleshooting

**Cannot login with super admin?**

- Check if the seeder service ran correctly
- Verify the database connection
- Check application logs for errors

**Permission denied errors?**

- Verify the admin token is valid
- Check the admin's role and permissions
- Ensure the admin account is active

**Cannot create other admins?**

- Only SUPER admins can create new admins
- Verify you're using a SUPER admin token

### 📚 Next Steps

1. **Change default password** immediately
2. **Create your admin team** with appropriate roles
3. **Set up monitoring** for admin activities
4. **Configure backup** for the admin collection
5. **Review and customize** permissions as needed

---

The admin system is now fully integrated and ready for production use! 🎉
