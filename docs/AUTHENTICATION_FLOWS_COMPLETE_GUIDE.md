# 🔐 Complete Authentication Flow Guide

## Table of Contents

1. [Flow 1: Email/Password Signup + Verification](#flow-1-emailpassword-signup--verification)
2. [Flow 2: Email/Password Login](#flow-2-emailpassword-login)
3. [Flow 3: Google OAuth Login](#flow-3-google-oauth-login)
4. [Flow 4: Facebook OAuth Login](#flow-4-facebook-oauth-login)
5. [Flow 5: Forget Password + Reset](#flow-5-forget-password--reset)
6. [Protected Routes: How JWT Validation Works](#protected-routes-how-jwt-validation-works)
7. [Single Device Login: Session Management](#single-device-login-session-management)

---

## Flow 1: Email/Password Signup + Verification

### Step-by-Step Process:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. POST /api/auth/signup                                        │
│    Body: { email, password, firstName, lastName }               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend (signup method)                                         │
│ • Hash password with bcrypt                                     │
│ • Create user in database (isVerified: false)                  │
│ • Generate unique session ID (jti): "abc123xyz"                │
│ • Store activeSessionId in user document                       │
│ • Generate OTP (6-digit code)                                  │
│ • Send OTP to user's email                                     │
│ • Create JWT with payload: { sub, email, role, jti }          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Response:                                                       │
│ {                                                               │
│   access_token: "eyJhbGc...",  ← JWT with jti: "abc123xyz"    │
│   user: { email, firstName, isVerified: false, ... },         │
│   levels: []                                                    │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. User receives email with OTP: "123456"                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. POST /api/auth/verify-otp                                    │
│    Body: { email, otp: "123456", cause: "EMAIL_VERIFICATION" } │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend (verifyOtp method)                                      │
│ • Validate OTP from database                                   │
│ • Update user: isVerified = true                               │
│ • Keep SAME activeSessionId: "abc123xyz" (no change!)         │
│ • Delete OTP record                                            │
│ • Generate JWT with SAME jti: "abc123xyz"                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Response:                                                       │
│ {                                                               │
│   access_token: "eyJhbGc...",  ← JWT with SAME jti            │
│   user: { email, firstName, isVerified: true, ... }           │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ ✅ User can use either token (signup or verify-otp)            │
│    Both have the same jti: "abc123xyz"                         │
└─────────────────────────────────────────────────────────────────┘
```

### Key Points:

- ✅ **Token from signup remains valid** after email verification
- ✅ **Same session ID** throughout the process
- ✅ User gets two tokens (one at signup, one at verification) - **both work!**
- ✅ If user logs in from another device, **both tokens become invalid**

---

## Flow 2: Email/Password Login

### Step-by-Step Process:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. POST /api/auth/login                                         │
│    Body: { email, password }                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend (login method)                                          │
│ • Find user by email                                            │
│ • Validate strategy is 'local' (not OAuth)                     │
│ • Check account status (not suspended/blocked)                 │
│ • Compare password hash with bcrypt                            │
│ • Generate NEW unique session ID: "xyz789new"                  │
│ • Update database:                                              │
│   - activeSessionId = "xyz789new" ← OVERWRITES OLD SESSION!   │
│   - lastActivity = now()                                        │
│ • Create JWT with new jti                                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Response:                                                       │
│ {                                                               │
│   access_token: "eyJhbGc...",  ← NEW JWT with jti: "xyz789new"│
│   user: { ... },                                                │
│   levelsDetails: [ ... ]                                        │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 ALL PREVIOUS TOKENS INVALIDATED!                            │
│    Old jti "abc123xyz" ≠ new jti "xyz789new"                  │
│    Any device with old token gets 401 Unauthorized             │
└─────────────────────────────────────────────────────────────────┘
```

### Key Points:

- 🔄 **New session created** on every login
- ❌ **All other devices logged out** automatically
- ✅ Only the **latest login** can access the account
- 🔒 **Single device enforcement** in action

---

## Flow 3: Google OAuth Login

### Step-by-Step Process:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks "Sign in with Google" on frontend                │
│    Frontend redirects to: GET /api/auth/google                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend (GoogleStrategy)                                        │
│ • Redirects user to Google OAuth consent screen                │
│ • User approves access                                          │
│ • Google redirects back to: /api/auth/google/callback          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. GET /api/auth/google/callback                                │
│    (Handled by Passport.js)                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ GoogleStrategy.validate()                                       │
│ • Extracts profile data from Google                            │
│ • Returns: { email, firstName, lastName, strategy: 'google' }  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Controller: googleAuthRedirect()                                │
│ • Calls findOrCreateOAuthUser()                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ findOrCreateOAuthUser() method                                  │
│ • Check if user exists by email                                │
│                                                                  │
│ IF USER DOESN'T EXIST:                                         │
│   • Generate NEW session ID: "oauth123new"                     │
│   • Create user with:                                           │
│     - strategy: 'google'                                        │
│     - isVerified: true (auto-verified)                         │
│     - activeSessionId: "oauth123new"                           │
│                                                                  │
│ IF USER EXISTS:                                                │
│   • Validate strategy matches (must be 'google')               │
│   • Generate NEW session ID: "oauth456new"                     │
│   • Update: activeSessionId = "oauth456new" ← LOGOUT OTHERS   │
│   • Update: lastActivity = now()                               │
│                                                                  │
│ • Generate JWT with the new jti                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Response (HTTP Redirect):                                       │
│ 302 Redirect to:                                                │
│ https://yourfrontend.com/oauth-callback?token=eyJhbGc...       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Frontend:                                                       │
│ • Extract token from URL query parameter                       │
│ • Store in localStorage/cookies                                │
│ • Use for subsequent API calls                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Points:

- ✅ **Auto-verified** (no email verification needed)
- 🔄 **Creates new session** every time
- ❌ **Logs out all other devices** on OAuth login
- 🔒 **Strategy validation** prevents mixing local & OAuth accounts

---

## Flow 4: Facebook OAuth Login

### Step-by-Step Process:

```
┌─────────────────────────────────────────────────────────────────┐
│ Same as Google OAuth, but:                                      │
│ • Frontend redirects to: GET /api/auth/facebook                 │
│ • Callback: GET /api/auth/facebook/callback                     │
│ • Uses FacebookStrategy instead of GoogleStrategy              │
│ • Strategy field in DB: 'facebook'                             │
│ • Everything else identical to Google flow                      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Points:

- Identical behavior to Google OAuth
- Different provider but same single-device enforcement

---

## Flow 5: Forget Password + Reset

### Step-by-Step Process:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. POST /api/auth/forget-password                               │
│    Body: { email }                                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend (forgetPassword method)                                 │
│ • Find user by email                                            │
│ • Generate OTP (6-digit code)                                  │
│ • Store OTP with cause: FORGET_PASSWORD                        │
│ • Send OTP to user's email                                     │
│ • NO SESSION CHANGES (activeSessionId unchanged)              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Response:                                                       │
│ { message: "Password reset OTP has been sent to your email" }  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. User receives email with OTP: "789012"                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. POST /api/auth/verify-otp                                    │
│    Body: { email, otp: "789012", cause: "FORGET_PASSWORD" }    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend (verifyOtp method)                                      │
│ • Validate OTP from database                                   │
│ • Delete OTP record                                            │
│ • Generate SHORT-LIVED resetToken (15 minutes)                 │
│   Payload: { email, type: 'password_reset' }                   │
│ • NO SESSION CHANGES (activeSessionId unchanged)              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Response:                                                       │
│ {                                                               │
│   resetToken: "eyJhbGc...",  ← Short-lived token (15 min)     │
│   message: "OTP verified. You can now reset your password"     │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. POST /api/auth/reset-password-token                          │
│    Body: { resetToken, newPassword }                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend (resetPasswordWithToken method)                         │
│ • Verify resetToken signature & expiration                     │
│ • Extract email from token payload                             │
│ • Hash new password with bcrypt                                │
│ • Update user password                                          │
│ • Update lastActivity                                           │
│ • NO SESSION CHANGES (activeSessionId unchanged)              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Response:                                                       │
│ { message: "Password reset successful" }                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. User must LOGIN again with new password                     │
│    POST /api/auth/login (See Flow 2)                            │
│    → This creates NEW session and logs out all devices         │
└─────────────────────────────────────────────────────────────────┘
```

### Key Points:

- 🔓 **Doesn't invalidate existing sessions** during reset process
- ⏱️ **ResetToken expires in 15 minutes** for security
- 🔐 User must **login after password reset** (creates new session)
- ✅ **Logged-in users keep access** until they login with new password

---

## Protected Routes: How JWT Validation Works

### Every Protected Request:

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend makes request to protected route:                     │
│ GET /api/user/me                                                │
│ Headers: { Authorization: "Bearer eyJhbGc..." }                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ UserJwtGuard (applies by default to all routes)                │
│ • Extracts JWT from Authorization header                       │
│ • Passes to UserJwtStrategy                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ UserJwtStrategy.validate()                                      │
│ 1. Verify JWT signature with JWT_SECRET                        │
│ 2. Check if token is expired                                   │
│ 3. Extract payload: { sub, email, role, jti }                  │
│ 4. Call validateUser(sub) to get user from DB                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ validateUser() method                                           │
│ • Find user by ID from DB                                      │
│ • Check if user exists                                         │
│ • Check if user is SUSPENDED or BLOCKED                        │
│ • Return user if valid, null otherwise                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 🔒 SINGLE DEVICE CHECK (UserJwtStrategy)                       │
│                                                                  │
│ IF payload.jti exists:                                         │
│   Compare payload.jti with user.activeSessionId                │
│                                                                  │
│   IF payload.jti ≠ user.activeSessionId:                      │
│     ❌ throw UnauthorizedException(                            │
│        "Session expired. Please login again."                  │
│     )                                                           │
│                                                                  │
│   IF payload.jti = user.activeSessionId:                      │
│     ✅ Continue (session is valid)                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ IF ALL CHECKS PASS:                                            │
│ • Attach user object to request: req.user = cleanResponse(user)│
│ • Continue to route handler                                    │
│                                                                  │
│ IF ANY CHECK FAILS:                                            │
│ • Throw 401 Unauthorized                                       │
│ • Return error to frontend                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Example: Multi-Device Scenario

```
Device A (Phone) - Login at 10:00 AM
└─> activeSessionId = "abc123"
└─> Token contains jti = "abc123"
└─> ✅ Can access API

Device B (Laptop) - Login at 10:05 AM
└─> activeSessionId = "xyz789" (DB updated!)
└─> Token contains jti = "xyz789"
└─> ✅ Can access API

Device A tries to use API at 10:06 AM
└─> Token has jti = "abc123"
└─> DB has activeSessionId = "xyz789"
└─> jti ≠ activeSessionId
└─> ❌ 401 Error: "Session expired. Please login again."
```

---

## Single Device Login: Session Management

### Session States:

| Action              | activeSessionId Changes      | Old Tokens Valid?        | Notes                        |
| ------------------- | ---------------------------- | ------------------------ | ---------------------------- |
| **Signup**          | ✅ New session created       | N/A                      | First session                |
| **Verify Email**    | ❌ NO CHANGE                 | ✅ Yes                   | Same session continues       |
| **Login (Local)**   | ✅ New session created       | ❌ No                    | All other devices logged out |
| **Login (OAuth)**   | ✅ New session created       | ❌ No                    | All other devices logged out |
| **Forget Password** | ❌ NO CHANGE                 | ✅ Yes                   | Sessions unaffected          |
| **Reset Password**  | ❌ NO CHANGE                 | ✅ Yes (until new login) | Must login after reset       |
| **Logout**          | Manual implementation needed | -                        | Currently not implemented    |

### Implementation Notes:

1. **No Explicit Logout Endpoint**

   - Currently not implemented in the codebase
   - Can be added: Clear `activeSessionId` from DB
   - Token becomes invalid immediately

2. **Token Expiration**

   - JWTs have built-in expiration (check JWT_EXPIRES_IN config)
   - Even if session valid, expired tokens rejected
   - Double layer of security

3. **Race Conditions**
   - Two simultaneous logins: Last one wins
   - Previous sessions immediately invalidated
   - No grace period

---

## Security Features Summary

✅ **Single Device Enforcement** - Only latest login works  
✅ **Automatic Session Invalidation** - No manual cleanup needed  
✅ **Strategy Validation** - Can't mix OAuth & local accounts  
✅ **Account Status Checks** - Suspended/blocked users rejected  
✅ **OTP Verification** - Email verification & password reset  
✅ **Short-lived Reset Tokens** - 15-minute expiry for security  
✅ **Password Hashing** - Bcrypt for secure storage  
✅ **JWT Signature Validation** - Prevents token tampering

---

## Common Error Messages

| Error                                   | Meaning                             | Solution                                   |
| --------------------------------------- | ----------------------------------- | ------------------------------------------ |
| "Session expired. Please login again."  | Token's jti doesn't match DB        | User logged in elsewhere, need to re-login |
| "User not found or inactive"            | User deleted or suspended           | Contact support                            |
| "Invalid Credentials"                   | Wrong email/password                | Check credentials                          |
| "Email already registered using google" | Trying local login on OAuth account | Use OAuth to login                         |
| "Invalid or expired OTP"                | Wrong OTP or expired                | Request new OTP                            |
| "Reset token has expired"               | Reset token older than 15 min       | Start password reset again                 |

---

## Frontend Integration Tips

### Store Token:

```javascript
// After login/signup
localStorage.setItem('access_token', response.access_token);
```

### Make Authenticated Requests:

```javascript
const token = localStorage.getItem('access_token');
axios.get('/api/user/me', {
  headers: { Authorization: `Bearer ${token}` },
});
```

### Handle 401 Errors:

```javascript
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token invalid or session expired
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
```

### OAuth Flow:

```javascript
// Redirect to backend OAuth endpoint
window.location.href = '/api/auth/google';

// On callback page (/oauth-callback)
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
if (token) {
  localStorage.setItem('access_token', token);
  window.location.href = '/dashboard';
}
```

---

## Diagram: Complete System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION SYSTEM                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Entry Points:                                                  │
│  • POST /auth/signup          → New user (needs email verify)  │
│  • POST /auth/login           → Existing user login            │
│  • GET  /auth/google          → Google OAuth                    │
│  • GET  /auth/facebook        → Facebook OAuth                  │
│  • POST /auth/forget-password → Start password reset           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Session Management:                                            │
│  • Every login creates NEW activeSessionId                     │
│  • Stored in user.activeSessionId field                        │
│  • Included in JWT as 'jti' claim                              │
│  • Validated on EVERY protected request                        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Protection Layer:                                              │
│  UserJwtGuard → UserJwtStrategy → validateUser() → jti check  │
│                                                                  │
│  Checks:                                                        │
│  1. Valid JWT signature                                        │
│  2. Not expired                                                │
│  3. User exists                                                │
│  4. User not suspended/blocked                                 │
│  5. jti matches activeSessionId ← SINGLE DEVICE ENFORCEMENT    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

**End of Documentation** 🎉
