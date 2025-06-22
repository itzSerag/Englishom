# User Suspension Feature - Quick Start Guide

## 🚀 Feature Summary

I've successfully implemented a comprehensive user suspension system for the Englishom application with the following key features:

### ✅ Completed Features

1. **Automated 65-Day Suspension System**

   - Modified existing cron job to suspend users inactive for 65+ days
   - Continues sending motivational emails to users inactive for 7+ days
   - Runs daily at 9:00 AM (Asia/Riyadh timezone)

2. **User Status Management**

   - Added `UserStatus` enum: `ACTIVE`, `SUSPENDED`, `BLOCKED`
   - Updated User model with status, suspendedAt, and suspensionReason fields
   - Created DTOs for admin user status management

3. **Admin Control Panel**

   - Created dedicated admin controller for user management
   - Endpoints for viewing, suspending, activating, and blocking users
   - Role-based permissions (SUPER/MANAGER for most actions, SUPER only for blocking)

4. **Security Integration**

   - Created `UserStatusGuard` to prevent suspended/blocked users from accessing the system
   - Updated authentication service to check user status during login
   - Added status validation to JWT token verification

5. **Email Notifications**
   - Created professional suspension notification email template
   - Clear instructions for users on how to contact support for reactivation
   - Reassurance that user progress is safely stored

## 🔧 How to Use

### For Admins

#### View All Users

```bash
GET /admin/users
Authorization: Bearer <ADMIN_TOKEN>
```

#### Get Suspended Users

```bash
GET /admin/users/status/suspended
Authorization: Bearer <ADMIN_TOKEN>
```

#### Suspend a User

```bash
PATCH /admin/users/:id/suspend
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "reason": "Extended inactivity"
}
```

#### Activate a User

```bash
PATCH /admin/users/:id/activate
Authorization: Bearer <ADMIN_TOKEN>
```

#### Block a User (SUPER Admin Only)

```bash
PATCH /admin/users/:id/block
Authorization: Bearer <SUPER_ADMIN_TOKEN>
Content-Type: application/json

{
  "reason": "Policy violation"
}
```

### For System Monitoring

#### Manual Trigger Cron Job

```bash
POST /cron/trigger-inactive-users
Authorization: Bearer <SUPER_ADMIN_TOKEN>
```

## 🔄 User Experience

### When a User is Suspended

1. **Automatic Suspension**: After 65 days of inactivity
2. **Email Notification**: Professional email explaining the suspension
3. **Login Prevention**: Cannot log in with clear error message
4. **API Access Blocked**: All authenticated endpoints return 403 Forbidden
5. **Support Contact**: Clear instructions on how to reactivate account

### Suspension Error Response

```json
{
  "message": "Your account has been suspended. Please contact support to reactivate your account.",
  "statusCode": 403,
  "error": "Account Suspended",
  "suspendedAt": "2024-12-06T09:00:00.000Z",
  "reason": "Account suspended due to inactivity (65+ days)"
}
```

## 📧 Email Templates

### Suspension Email Features

- ⚠️ Clear warning header with suspension notice
- 📞 Multiple contact methods for support
- 🛡️ Reassurance that progress is safe
- 🎨 Professional, responsive design
- 🔗 Direct link to support/contact page

## 🔍 Monitoring

### Cron Job Logs

```
🔄 Starting inactive user management job...
📧 Found 15 users for motivational emails
⚠️ Found 5 users to suspend
⚠️ User suspended: user@example.com
✅ Inactive user management job completed in 8.2s
📊 Results: 15 motivation emails sent, 0 failed
📊 Suspensions: 5 successful, 0 failed
```

## 🎯 Business Impact

### Benefits Achieved

1. **Platform Security**: Inactive accounts are properly managed
2. **Resource Optimization**: System resources focused on active users
3. **User Engagement**: Two-tier approach encourages user return
4. **Admin Control**: Comprehensive tools for user account management
5. **Professional Communication**: Clear, helpful suspension notifications

### User Journey

1. **Active User** → 7 days inactive → **Motivational Email**
2. **Still Inactive** → 65 days total → **Account Suspended** + **Email Notification**
3. **User Contacts Support** → **Admin Review** → **Account Reactivated**

## 🔐 Security Features

- ✅ Login blocking for suspended/blocked users
- ✅ API access prevention through global guards
- ✅ Real-time status checking on all requests
- ✅ Admin-only management capabilities
- ✅ Role-based permissions for different admin levels

## 📱 Frontend Integration

When implementing the frontend, handle these status responses:

```javascript
// Login response handling
if (error.status === 401 && error.error === 'Account Suspended') {
  // Show suspension notice with support contact info
  showSuspensionModal(error.suspendedAt, error.reason);
}

// API request handling
if (error.status === 403 && error.error === 'Account Suspended') {
  // Redirect to suspended account page
  redirectToSuspendedPage();
}
```

## 🎉 Success Metrics

The system is now ready to:

- ✅ Automatically manage inactive user accounts
- ✅ Provide comprehensive admin controls
- ✅ Maintain platform security and performance
- ✅ Deliver professional user communication
- ✅ Enable easy account reactivation workflow

**The user suspension feature is fully implemented and ready for production use! 🚀**
