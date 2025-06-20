# CRON Job Documentation - Inactive User Email System

## 📋 Overview

The Englishom application includes an automated CRON job system that sends motivational emails to inactive users to encourage them to return to their English learning journey. This system runs daily and identifies users who haven't been active for 7 days, then sends them personalized motivational emails.

## 🎯 Purpose

- **User Retention**: Bring back inactive users to the platform
- **Learning Continuity**: Encourage users to maintain their learning habits
- **Engagement**: Increase overall user engagement and platform activity
- **Automated Marketing**: Reduce manual effort in user retention campaigns

## ⚙️ How It Works

### 1. **Daily Automated Execution**

- **Schedule**: Every day at 9:00 AM (Asia/Riyadh timezone)
- **Frequency**: Once per day
- **Execution**: Fully automated, no manual intervention required

### 2. **User Detection Logic**

The system identifies inactive users based on the following criteria:

- **Inactivity Period**: Users with `lastActivity` older than 7 days
- **User Type**: Excludes admin users (only targets regular users)
- **Verification Status**: Only sends emails to verified users
- **Account Status**: Only active accounts are considered

### 3. **Email Sending Process**

- **Template**: Uses a beautiful HTML template with personalized content
- **Personalization**: Includes user's first name and custom login URL
- **Rate Limiting**: 300ms delay between emails to avoid overwhelming email service
- **Error Handling**: Continues processing even if individual emails fail

## 🔧 Configuration

### Environment Variables

Make sure these environment variables are set in your `.env` file:

```env
# Email Configuration (Required)
SMTP_HOST=your-smtp-host.com
SMTP_PORT=587
SMTP_USER=no-reply@englishom.com
SMTP_PASS=your-smtp-password

# Frontend URL (Optional)
FRONTEND_URL=https://englishom.com/login

# Timezone (Optional - defaults to Asia/Riyadh)
TZ=Asia/Riyadh
```

### CRON Schedule

The CRON job uses the following schedule:

- **Cron Expression**: `0 9 * * *`
- **Meaning**: At 09:00 AM every day
- **Timezone**: Asia/Riyadh

To modify the schedule, edit the `@Cron` decorator in `/src/cron/inactive-user-cron.service.ts`:

```typescript
@Cron('0 9 * * *', {
  name: 'send-inactive-user-emails',
  timeZone: 'Asia/Riyadh'  // Change timezone here
})
```

## 🚀 Usage

### Automatic Execution

The CRON job runs automatically once deployed. No manual intervention is required.

### Manual Execution (For Testing)

You can manually trigger the CRON job using the API endpoint:

```bash
# Login as Super Admin first
curl -X POST http://localhost:3000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@englishom.com",
    "password": "your-password"
  }'

# Use the returned token to trigger the CRON job
curl -X POST http://localhost:3000/cron/trigger-inactive-users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response Example:**

```json
{
  "message": "Inactive user email job triggered manually",
  "timestamp": "2024-12-06T09:00:00.000Z"
}
```

## 📧 Email Template

### Template Features

- **Responsive Design**: Works on all devices
- **Professional Styling**: Modern gradient design with engaging colors
- **Personalization**: Dynamic user name and login URL
- **Clear Call-to-Action**: Prominent "Continue Learning" button
- **Motivational Content**: Encouraging message to return to learning

### Template Variables

- `{{userName}}`: User's first name (fallback: "there")
- `{{loginUrl}}`: Frontend login URL (from environment variable)

### Customizing the Email Template

To customize the email template, edit the file:
`/src/cron/email-template.html`

Or modify the fallback template in the service:
`/src/cron/inactive-user-cron.service.ts` (in the `getFallbackTemplate()` method)

## 📊 Monitoring & Logging

### Log Messages

The CRON job provides detailed logging for monitoring:

```
🔄 Starting inactive user email job...
📧 Found 25 inactive users
✉️ Email sent to: user@example.com
✅ Inactive user email job completed in 12.5s
📊 Results: 23 successful, 2 failed
```

### Error Handling

- **Individual Email Failures**: Continues processing other users
- **Template Loading Errors**: Falls back to embedded template
- **Database Errors**: Logged with full stack trace
- **Email Service Errors**: Detailed error messages for each failure

### Monitoring Checklist

Monitor these aspects in production:

- [ ] Daily job execution logs
- [ ] Success/failure rates
- [ ] Email delivery status
- [ ] Database performance during job execution
- [ ] Email service rate limits

## 🛠️ Troubleshooting

### Common Issues

#### 1. **CRON Job Not Running**

**Symptoms**: No log messages appear at scheduled time
**Solutions**:

- Check if `@nestjs/schedule` is properly installed
- Verify `ScheduleModule.forRoot()` is imported in `CronModule`
- Ensure application is running during scheduled time
- Check server timezone settings

#### 2. **No Emails Being Sent**

**Symptoms**: Job runs but no emails are delivered
**Solutions**:

- Verify SMTP configuration in environment variables
- Check email service credentials
- Ensure `EmailService` is properly injected
- Test email service independently

#### 3. **Template Loading Errors**

**Symptoms**: Emails sent with basic template instead of custom design
**Solutions**:

- Verify `email-template.html` exists in `/src/cron/` directory
- Check file permissions
- Fallback template is used automatically

#### 4. **Database Query Errors**

**Symptoms**: Job fails with database-related errors
**Solutions**:

- Check database connection
- Verify `UserRepo` is properly injected
- Ensure user schema has `lastActivity` field

### Performance Optimization

For large user bases (>1000 inactive users):

- Implement batch processing
- Add pagination to user queries
- Increase delay between emails
- Consider using a queue system

## 🔒 Security Considerations

### Access Control

- Manual trigger endpoint requires **Super Admin** privileges
- No sensitive user data is logged
- Email content is templated (no user-generated content)

### Data Privacy

- Only sends emails to verified users
- Respects user account status
- No tracking pixels or external resources in emails

### Rate Limiting

- 300ms delay between emails prevents spam
- Respects email service rate limits
- Graceful error handling prevents service disruption

## 📈 Performance Metrics

### Expected Performance

- **Processing Speed**: ~3-4 emails per second
- **Memory Usage**: Minimal (streams users, doesn't load all at once)
- **Database Impact**: Single query to find inactive users
- **Email Service Load**: Distributed over time with delays

### Scaling Considerations

- For >10,000 users: Consider implementing batching
- For multiple servers: Ensure only one instance runs the CRON job
- For high email volumes: Consider using a dedicated email queue service

## 🧪 Testing

### Unit Testing

```bash
# Run tests for CRON service
npm test cron

# Run specific test file
npm test inactive-user-cron.service.spec.ts
```

### Integration Testing

```bash
# Test manual trigger endpoint
npm run test:e2e cron
```

### Local Development Testing

```bash
# Start application in development mode
npm run start:dev

# Trigger manually via API
curl -X POST http://localhost:3000/cron/trigger-inactive-users
```

## 📚 Related Documentation

- [Admin System Documentation](./ADMIN_SYSTEM.md)
- [Email Service Configuration](../src/common/mail/README.md)
- [User Management Guide](./USER_MANAGEMENT.md)
- [Environment Variables Guide](./ENVIRONMENT_SETUP.md)

## 🆘 Support

If you encounter issues with the CRON job system:

1. **Check Logs**: Review application logs for error messages
2. **Verify Configuration**: Ensure all environment variables are set
3. **Test Manually**: Use the manual trigger endpoint for debugging
4. **Monitor Database**: Check database connectivity and performance
5. **Email Service**: Verify SMTP settings and credentials

## 📝 Changelog

### Version 1.0.0

- Initial implementation
- Daily automated execution at 9:00 AM
- HTML email template with personalization
- Manual trigger endpoint for admins
- Comprehensive error handling and logging
- Fallback template system

---

## 🎯 Quick Start Checklist

- [ ] Verify `@nestjs/schedule` is installed
- [ ] Set up SMTP environment variables
- [ ] Configure `FRONTEND_URL` environment variable
- [ ] Deploy application with CRON module enabled
- [ ] Test manual trigger endpoint
- [ ] Monitor logs for first automated execution
- [ ] Verify email delivery to test users

**The CRON job system is now ready to help boost user engagement and retention! 🚀**
