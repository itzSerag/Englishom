# Admin System Documentation

## Overview

This admin system provides a comprehensive role-based access control system with the following admin roles:

### Admin Roles

- **SUPER**: Can do anything + can make new admins and cannot be deleted
- **MANAGER**: Can upload content, modify content, and manage users
- **OPERATOR**: Can upload content and modify content
- **VIEW**: Default role for new admins (view-only access unless super admin grants more permissions)

## Features

- ✅ Separate admin authentication system
- ✅ Role-based access control with granular permissions
- ✅ Protected admin creation (only SUPER admins can create new admins)
- ✅ Protection against deleting the last SUPER admin
- ✅ Admin user management capabilities
- ✅ Content management through admin interface
- ✅ Activity tracking and session management
- ✅ Automatic initial SUPER admin creation

## API Endpoints

### Authentication

- `POST /admin/login` - Admin login (Public)

### Admin Management

- `POST /admin/create` - Create new admin (SUPER only)
- `GET /admin/all` - Get all admins (SUPER, MANAGER)
- `GET /admin/profile` - Get current admin profile
- `GET /admin/:id` - Get admin by ID (SUPER, MANAGER)
- `PATCH /admin/:id` - Update admin (SUPER can update anyone, others can update themselves)
- `DELETE /admin/:id` - Delete admin (SUPER only, cannot delete self or last SUPER)

### User Management (Admin)

- `GET /admin/users` - Get all users (MANAGER+)
- `GET /admin/users/:id` - Get user by ID (MANAGER+)
- `PATCH /admin/users/:id` - Update user (MANAGER+)
- `DELETE /admin/users/:id` - Delete user (SUPER only)
- `GET /admin/users/:id/progress` - Get user progress (MANAGER+)

### Content Management (Admin)

- `POST /admin/content/courses` - Create course (OPERATOR+)
- `GET /admin/content/courses` - Get all courses (All roles)
- `GET /admin/content/courses/:id` - Get course by ID (All roles)
- `PATCH /admin/content/courses/:id` - Update course (OPERATOR+)
- `DELETE /admin/content/courses/:id` - Delete course (MANAGER+)

## Initial Setup

On first startup, the system automatically creates an initial SUPER admin:

- **Email**: `superadmin@englishom.com`
- **Password**: `SuperAdmin123!`
- **⚠️ IMPORTANT**: Change this password immediately after first login!

## Permission Matrix

| Action         | SUPER | MANAGER | OPERATOR | VIEW |
| -------------- | ----- | ------- | -------- | ---- |
| Create Admins  | ✅    | ❌      | ❌       | ❌   |
| Manage Admins  | ✅    | 👁️      | ❌       | ❌   |
| Delete Admins  | ✅    | ❌      | ❌       | ❌   |
| Manage Users   | ✅    | ✅      | ❌       | ❌   |
| Delete Users   | ✅    | ❌      | ❌       | ❌   |
| Create Content | ✅    | ✅      | ✅       | ❌   |
| Edit Content   | ✅    | ✅      | ✅       | ❌   |
| Delete Content | ✅    | ✅      | ❌       | ❌   |
| View Content   | ✅    | ✅      | ✅       | ✅   |
| View Reports   | ✅    | ✅      | ✅       | ✅   |

Legend: ✅ Full Access, 👁️ View Only, ❌ No Access

## Security Features

- JWT-based authentication with separate tokens for admins
- Password hashing with bcrypt
- Activity tracking and session management
- Protection against critical actions (e.g., deleting last SUPER admin)
- Input validation and sanitization
- Rate limiting through existing throttler

## Usage Examples

### Login as Admin

```bash
curl -X POST http://your-api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@englishom.com",
    "password": "SuperAdmin123!"
  }'
```

### Create New Admin (SUPER admin only)

```bash
curl -X POST http://your-api/admin/create \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@example.com",
    "firstName": "Manager",
    "lastName": "User",
    "password": "SecurePassword123!",
    "role": "manager"
  }'
```

### Get All Users (Admin)

```bash
curl -X GET http://your-api/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Migration from Old System

The system maintains backward compatibility with the old admin system:

- Existing `AdminGuard` is updated to recognize new admin roles
- JWT strategy handles both user and admin tokens
- No changes required to existing user functionality

## Best Practices

1. **Always change default SUPER admin password**
2. **Use principle of least privilege** - Grant minimum required permissions
3. **Regularly audit admin accounts** and remove unused ones
4. **Monitor admin activity** through the activity tracking
5. **Use strong passwords** for all admin accounts
6. **Rotate admin tokens** regularly for security

## Database Schema

The admin system uses a separate `Admin` collection with the following fields:

- `email`: Unique admin email
- `firstName`, `lastName`: Admin name
- `password`: Bcrypt hashed password
- `role`: AdminRole enum (super, manager, operator, view)
- `isActive`: Boolean flag for soft deletion
- `isVerified`: Email verification status
- `lastActivity`: Last activity timestamp
- `createdBy`: Reference to admin who created this account
- `country`, `city`: Optional location fields

## Error Handling

The system provides comprehensive error handling:

- `UnauthorizedException`: Invalid credentials or unauthorized access
- `ForbiddenException`: Insufficient permissions for action
- `ConflictException`: Duplicate admin email
- `NotFoundException`: Admin not found
- `BadRequestException`: Invalid request data or protected actions

## Troubleshooting

1. **Cannot create SUPER admin**: Check if initial seeder ran correctly
2. **Permission denied**: Verify admin role and token validity
3. **Cannot delete admin**: Check if trying to delete last SUPER admin
4. **Login issues**: Verify email/password and account active status
