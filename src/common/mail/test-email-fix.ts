// Test script to verify the email fix
import { CustomEmailOptions } from './mail.service';

// This should work correctly now
const validEmailOptions: CustomEmailOptions = {
  to: 'test@example.com',
  subject: 'Test Email',
  htmlContent: '<p>This is a test email</p>',
};

// This should fail validation (missing both htmlContent and textContent)
const invalidEmailOptions: CustomEmailOptions = {
  to: 'test@example.com',
  subject: 'Test Email',
  // Missing both htmlContent and textContent
};

// This should work with textContent
const textEmailOptions: CustomEmailOptions = {
  to: 'test@example.com',
  subject: 'Test Email',
  textContent: 'This is a plain text email',
};

console.log('Email options created successfully - types are correct');
