// Example usage of the MailService

import { MailService, CustomEmailOptions } from '../common/mail/mail.service';

// Example 1: Simple email
async function sendWelcomeEmail(mailService: MailService, userEmail: string, userName: string) {
const emailOptions: CustomEmailOptions = {
to: userEmail,
subject: 'Welcome to Englishom!',
htmlContent: `       <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1>Welcome ${userName}!</h1>
        <p>Thank you for joining Englishom. We're excited to have you on board!</p>
        <p>Best regards,<br>The Englishom Team</p>
      </div>
    `,
textContent: `Welcome ${userName}! Thank you for joining Englishom. We're excited to have you on board!`
};

return await mailService.sendCustomEmail(emailOptions);
}

// Example 2: Email with attachments and CC
async function sendCourseCompletionCertificate(
mailService: MailService,
userEmail: string,
userName: string,
certificateBase64: string
) {
const emailOptions: CustomEmailOptions = {
to: userEmail,
cc: ['admin@englishom.com'],
subject: 'Course Completion Certificate - Congratulations!',
htmlContent: `       <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1>Congratulations ${userName}!</h1>
        <p>You have successfully completed your English course.</p>
        <p>Please find your certificate attached to this email.</p>
        <p>Best regards,<br>The Englishom Team</p>
      </div>
    `,
attachments: [
{
name: 'certificate.pdf',
content: certificateBase64,
contentType: 'application/pdf'
}
],
replyTo: {
email: 'support@englishom.com',
name: 'Englishom Support'
}
};

return await mailService.sendCustomEmail(emailOptions);
}

// Example 3: Using the convenience method
async function sendSimpleNotification(mailService: MailService, userEmail: string) {
return await mailService.sendSimpleEmail(
userEmail,
'Course Reminder',
'<p>Don\'t forget about your English lesson today at 3 PM!</p>',
'Don\'t forget about your English lesson today at 3 PM!'
);
}
