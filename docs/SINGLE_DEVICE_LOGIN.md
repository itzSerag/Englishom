# Single Device Login Implementation

## Overview

This implementation ensures that only one device can be logged in at a time for each user. When a user logs in from a new device, all other sessions are automatically invalidated.

## How It Works

### 1. Database Changes

- **Field Added**: `activeSessionId` (string, optional) to User schema
- Stores the unique session identifier (jti) of the currently active session

### 2. Token Generation

- Each JWT now includes a unique `jti` (JWT ID) field
- The `jti` is generated using: `Math.random().toString(36).substring(2) + Date.now().toString(36)`
- Format: `{ sub: userId, email: userEmail, role: 'user', jti: 'uniqueSessionId' }`

### 3. Login Flow

When a user logs in (via any method):

1. Generate a new unique `jti`
2. Store the `jti` in the database as `activeSessionId`
3. Issue a JWT containing the `jti`
4. This automatically invalidates all previous sessions

### 4. Request Validation

On every authenticated request:

1. Extract the `jti` from the JWT
2. Compare it with the `activeSessionId` stored in the database
3. If they don't match → throw `UnauthorizedException` with message: "Session expired. Please login again."
4. If they match → allow the request to proceed

## Affected Components

### Modified Files

1. **`src/user/models/user.schema.ts`**

   - Added `activeSessionId?: string` field

2. **`src/common/shared/interfaces/payload.interface.ts`**

   - Added `jti?: string` to `IPayload` interface

3. **`src/user-auth/user-auth.service.ts`**

   - Modified `signup()` - generates and stores `activeSessionId`
   - Modified `login()` - generates and stores new `activeSessionId` (invalidates old sessions)
   - Modified `verifyOtp()` - keeps the same `activeSessionId` from signup for email verification (no session change)
   - Modified `findOrCreateOAuthUser()` - generates and stores `activeSessionId` for OAuth logins
   - Added `generateTokenWithJti()` - helper to generate token with specific jti
   - Modified `generateToken()` - now generates unique jti

4. **`src/user-auth/strategy/user-jwt.strategy.ts`**

   - Added validation logic to check `jti` against stored `activeSessionId`

5. **`src/user-auth/user-auth.controller.ts`**
   - Modified `verifyOtp()` - now expects `{ user, access_token }` from service

## Login Methods Covered

✅ Email/Password login (local strategy)
✅ Email verification after signup (keeps same session from signup)
✅ Google OAuth
✅ Facebook OAuth
✅ All authentication flows

## Special Behavior: Email Verification Flow

When a user signs up:

1. They receive an access token immediately with a session ID
2. Email verification OTP is sent
3. When they verify their email, the **same session ID is kept**
4. The token from signup remains valid after verification
5. This allows seamless user experience - no need to login again after verification

## Benefits

- **Simple**: No need for Redis or separate session storage
- **Minimal**: Only one new field in the database
- **Secure**: Automatically logs out from all other devices
- **Instant**: No polling or background jobs needed
- **Scalable**: Works with MongoDB queries efficiently

## User Experience

When a user logs in from Device B:

- Device A will receive `401 Unauthorized` with message "Session expired. Please login again."
- Frontend should catch this error and redirect to login page
- User must login again from Device A to use it

## Testing

To test the implementation:

1. Login from Device/Browser A → Get Token A
2. Login from Device/Browser B → Get Token B
3. Try to use Token A → Should receive 401 error
4. Token B should work fine

## Security Considerations

- The `jti` is randomly generated and includes timestamp
- Old tokens cannot be reused even if they haven't expired
- No session table needed - the User document itself tracks the active session
- Works seamlessly with existing JWT expiration
