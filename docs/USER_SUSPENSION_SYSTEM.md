# User Suspension System Documentation

## 📋 Overview

The Englishom application now includes an automated user suspension system that manages user accounts based on activity levels and provides admin controls for user account management.

## 🎯 Purpose

- **Automatic Suspension**: Suspend users who are inactive for 65+ days
- **Account Security**: Maintain platform security by managing inactive accounts
- **Admin Control**: Provide comprehensive user management capabilities for administrators
- **User Communication**: Notify users about account status changes and reactivation procedures

## ⚙️ How It Works

### 1. **Automated User Management**

- **Daily Execution**: Runs every day at 9:00 AM (Asia/Riyadh timezone)
- **Two-tier System**:
  - **7+ days inactive**: Send motivational emails to encourage return
  - **65+ days inactive**: Automatically suspend accounts

### 2. **User Status Types**

```typescript
enum UserStatus {
  ACTIVE = 'active', // Normal, active account
  SUSPENDED = 'suspended', // Temporarily suspended, can be reactivated
  BLOCKED = 'blocked', // Permanently blocked, admin intervention required
}
```

### 3. **Account Status Checking**

- **Login Protection**: Suspended/blocked users cannot log in
- **API Protection**: Global guard prevents suspended/blocked users from accessing endpoints
- **Real-time Validation**: Status checked on every request

## 🛡️ Security Features

### Authentication Integration

- **Login Blocking**: Suspended/blocked users receive appropriate error messages during login
- **JWT Validation**: User status checked during token validation
- **Session Management**: Existing sessions invalidated when user is suspended/blocked

### Guard System

- **UserStatusGuard**: Global guard applied to all authenticated routes
- **Admin Bypass**: Admin users bypass user status checks
- **Public Route Exclusion**: Public routes are not affected

## 📧 Email Notifications

### Suspension Email Features

- **Professional Design**: Responsive HTML template with modern styling
- **Clear Messaging**: Explains reason for suspension and next steps
- **Support Information**: Multiple contact methods for account reactivation
- **Progress Assurance**: Confirms that user progress is safely stored

### Template Variables

- `{{userName}}`: User's first name (fallback: "there")
- `{{supportUrl}}`: Frontend contact/support URL

## 🔧 Admin Management Features

### Admin Endpoints

All admin endpoints require appropriate roles (SUPER/MANAGER access):

#### User Management

- `GET /admin/users` - Get all users with pagination
- `GET /admin/users/status/:status` - Get users by status
- `GET /admin/users/:id` - Get specific user details

#### Status Management

- `PATCH /admin/users/:id/status` - Update user status with reason
- `PATCH /admin/users/:id/suspend` - Quick suspend user
- `PATCH /admin/users/:id/activate` - Quick activate user
- `PATCH /admin/users/:id/block` - Block user (SUPER only)

### Permission Matrix

| Action             | SUPER | MANAGER | OPERATOR | VIEW |
| ------------------ | ----- | ------- | -------- | ---- |
| View Users         | ✅    | ✅      | ❌       | ❌   |
| Suspend Users      | ✅    | ✅      | ❌       | ❌   |
| Activate Users     | ✅    | ✅      | ❌       | ❌   |
| Block Users        | ✅    | ❌      | ❌       | ❌   |
| View User Progress | ✅    | ✅      | ❌       | ❌   |

## 🚀 Usage Examples

### Admin Usage

#### Suspend a User

```bash
curl -X PATCH http://localhost:3000/admin/users/USER_ID/suspend \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Policy violation"}'
```

#### Activate a User

```bash
curl -X PATCH http://localhost:3000/admin/users/USER_ID/activate \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Get Suspended Users

```bash
curl -X GET http://localhost:3000/admin/users/status/suspended \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Manual Cron Trigger

```bash
curl -X POST http://localhost:3000/cron/trigger-inactive-users \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN"
```

## 📊 Monitoring & Logging

### Cron Job Logs

```
🔄 Starting inactive user management job...
📧 Found 15 users for motivational emails
⚠️ Found 5 users to suspend
⚠️ User suspended: user@example.com
✉️ Email sent to: active_user@example.com
✅ Inactive user management job completed in 8.2s
📊 Results: 15 motivation emails sent, 0 failed
📊 Suspensions: 5 successful, 0 failed
```

### Error Handling

- **Individual Failures**: System continues processing even if individual operations fail
- **Email Delivery**: Detailed logging for email sending success/failure
- **Database Errors**: Comprehensive error logging with stack traces

## 🔄 User Reactivation Process

### For Users

1. **Contact Support**: Use provided contact methods in suspension email
2. **Provide Information**: Explain reactivation request
3. **Admin Review**: Support team reviews and processes request
4. **Account Restoration**: Admin reactivates account, restoring full access

### For Admins

1. **Review Request**: Assess user's reactivation request
2. **Update Status**: Use admin endpoints to change status to ACTIVE
3. **Notify User**: Inform user of account reactivation
4. **Monitor Activity**: Track user's return to activity

## 📈 Performance Considerations

### Scalability

- **Batch Processing**: System processes users in batches to avoid memory issues
- **Rate Limiting**: 300ms delay between emails prevents service overload
- **Database Optimization**: Efficient queries with proper indexing

### Expected Performance

- **Processing Speed**: ~3-4 operations per second
- **Memory Usage**: Minimal memory footprint
- **Database Impact**: Optimized queries with minimal load

## 🛠️ Configuration

### Environment Variables

Ensure these variables are configured:

```env
# Email Configuration
SMTP_HOST=your-smtp-host.com
SMTP_PORT=587
SMTP_USER=no-reply@englishom.com
SMTP_PASS=your-smtp-password

# Frontend URL for support links
FRONTEND_URL=https://englishom.com

# Timezone for cron execution
TZ=Asia/Riyadh
```

### Database Schema Changes

The User model now includes:

```typescript
@Prop({ enum: UserStatus, default: UserStatus.ACTIVE })
status: UserStatus;

@Prop({ type: Date })
suspendedAt?: Date;

@Prop({ type: String })
suspensionReason?: string;
```

## 🧪 Testing

### Manual Testing

1. **Create Test Users**: With different activity dates
2. **Trigger Cron Job**: Use manual trigger endpoint
3. **Verify Suspensions**: Check user status changes
4. **Test Admin Controls**: Use admin endpoints to manage users
5. **Verify Email Delivery**: Check suspension notification emails

### Status Transition Testing

- Active → Suspended → Active
- Active → Blocked (permanent)
- Login attempts with different statuses
- API access with different statuses

## 🚨 Troubleshooting

### Common Issues

1. **Cron Job Not Running**

   - Check application logs
   - Verify cron module is imported
   - Ensure timezone configuration

2. **Users Not Being Suspended**

   - Check lastActivity dates in database
   - Verify UserStatus enum values
   - Review cron job execution logs

3. **Email Delivery Issues**

   - Verify SMTP configuration
   - Check email service credentials
   - Review email template loading

4. **Admin Access Issues**
   - Verify admin roles and permissions
   - Check JWT token validity
   - Review guard configurations

## 🔮 Future Enhancements

### Potential Improvements

- **Grace Period**: Warning emails before suspension
- **Progressive Suspension**: Multiple warning levels
- **Bulk Operations**: Admin tools for bulk user management
- **Analytics Dashboard**: User activity and suspension metrics
- **Custom Suspension Periods**: Configurable inactivity thresholds

## 📝 Changelog

### Version 1.0.0 - User Suspension System

- ✅ Automated 65-day suspension system
- ✅ Admin user management endpoints
- ✅ User status guard system
- ✅ Suspension email notifications
- ✅ Integration with existing cron system
- ✅ Comprehensive logging and monitoring

---

**The User Suspension System is now ready to enhance platform security and user management! 🚀**
