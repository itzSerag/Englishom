#!/usr/bin/env node

/**
 * Simple script to check environment variables for mail service
 * Run this on your VPS to verify environment setup
 */

console.log('🔍 Checking Englishom Mail Service Environment...\n');

// Check Node.js version
console.log(`📦 Node.js version: ${process.version}`);
console.log(`🏃 Platform: ${process.platform}`);
console.log(`📁 Working directory: ${process.cwd()}\n`);

// Check critical environment variables
const requiredEnvVars = [
  'NODE_ENV',
  'DATABASE_URL', 
  'JWT_SECRET',
  'BREVO_API_KEY'
];

const optionalEnvVars = [
  'BASE_URL',
  'WEBSITE_URL',
  'PORT'
];

console.log('📋 Required Environment Variables:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    // Mask sensitive values
    let displayValue = value;
    if (varName.includes('SECRET') || varName.includes('KEY')) {
      displayValue = value.length > 10 
        ? `${value.substring(0, 6)}...${value.substring(value.length - 4)}`
        : '***MASKED***';
    }
    console.log(`  ✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`  ❌ ${varName}: NOT SET`);
  }
});

console.log('\n📋 Optional Environment Variables:');
optionalEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value}`);
  } else {
    console.log(`  ⚠️  ${varName}: NOT SET`);
  }
});

// Specific Brevo API Key validation
console.log('\n🔧 Brevo API Key Analysis:');
const brevoKey = process.env.BREVO_API_KEY;
if (brevoKey) {
  console.log(`  📏 Length: ${brevoKey.length} characters`);
  console.log(`  🏷️  Starts with 'xkeysib-': ${brevoKey.startsWith('xkeysib-') ? '✅ YES' : '❌ NO'}`);
  console.log(`  🔍 Format looks valid: ${brevoKey.match(/^xkeysib-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-[a-zA-Z0-9]+$/) ? '✅ YES' : '⚠️ UNCERTAIN'}`);
} else {
  console.log('  ❌ BREVO_API_KEY not found in environment');
}

// Check for .env file
const fs = require('fs');
const path = require('path');

console.log('\n📁 Environment File Check:');
const envFiles = ['.env', '.env.local', '.env.production'];
envFiles.forEach(fileName => {
  const envPath = path.join(process.cwd(), fileName);
  if (fs.existsSync(envPath)) {
    const stats = fs.statSync(envPath);
    console.log(`  ✅ ${fileName}: EXISTS (${stats.size} bytes, modified: ${stats.mtime.toISOString()})`);
  } else {
    console.log(`  ❌ ${fileName}: NOT FOUND`);
  }
});

console.log('\n🏁 Environment check completed!');
console.log('\n💡 Troubleshooting tips:');
console.log('  1. Ensure BREVO_API_KEY is correctly set in your production environment');
console.log('  2. API key should start with "xkeysib-"');
console.log('  3. Verify the API key is active in your Brevo dashboard');
console.log('  4. Check that .env file exists and is readable');
console.log('  5. Restart your application after environment changes');
