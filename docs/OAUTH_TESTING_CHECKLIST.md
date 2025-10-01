# OAuth Testing Checklist

## Pre-Testing Setup

### 1. Environment Variables
Check your `.env` file has these values:

```env
BASE_URL=https://serag-eldien.site
FRONTEND_URL=https://serag-eldien.site
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
FACEBOOK_APP_ID=<your-facebook-app-id>
FACEBOOK_APP_SECRET=<your-facebook-app-secret>
```

### 2. Restart Backend Server
After changing `.env`, restart your server:
```bash
npm run start:dev
```

### 3. Check Server Logs
On startup, verify you see:
```
Google Strategy initialized with callback URL: https://serag-eldien.site/api/auth/google/callback
Facebook Strategy initialized with callback URL: https://serag-eldien.site/api/auth/facebook/callback
```

### 4. Verify OAuth Provider Settings

#### Google Cloud Console
1. Go to https://console.cloud.google.com/
2. Navigate to: APIs & Services > Credentials
3. Click your OAuth 2.0 Client ID
4. Verify "Authorized redirect URIs" includes:
   ```
   https://serag-eldien.site/api/auth/google/callback
   ```

#### Facebook Developer Console
1. Go to https://developers.facebook.com/
2. Select your app
3. Navigate to: Facebook Login > Settings
4. Verify "Valid OAuth Redirect URIs" includes:
   ```
   https://serag-eldien.site/api/auth/facebook/callback
   ```

## Testing Google OAuth

### Test 1: Initiate Login
1. Open: `https://serag-eldien.site/api/auth/google`
2. ✅ Should redirect to Google login page
3. ❌ If you get 500 error, check Google credentials in `.env`

### Test 2: Complete Login (New User)
1. Select a Google account
2. ✅ Should redirect to: `https://serag-eldien.site/auth/callback?token=<JWT>`
3. ❌ If redirects to `www.google.com/auth/callback`, check `FRONTEND_URL` in `.env`
4. ❌ If you get 404, verify callback URL in Google Console

### Test 3: Complete Login (Existing User)
1. Use same Google account as Test 2
2. ✅ Should redirect to: `https://serag-eldien.site/auth/callback?token=<JWT>`
3. ✅ Token should be different from Test 2 (new token generated)

### Test 4: Email Conflict
1. First create a local account with email: `test@example.com`
2. Try to login with Google using same email
3. ✅ Should redirect to: `https://serag-eldien.site/auth/callback?error=auth_failed&message=Email%20already%20registered%20using%20local...`

## Testing Facebook OAuth

### Test 5: Initiate Login
1. Open: `https://serag-eldien.site/api/auth/facebook`
2. ✅ Should redirect to Facebook login page
3. ❌ If you get 500 error, check Facebook credentials in `.env`

### Test 6: Complete Login (New User)
1. Select a Facebook account
2. ✅ Should redirect to: `https://serag-eldien.site/auth/callback?token=<JWT>`
3. ❌ If redirects to `www.facebook.com/auth/callback`, check `FRONTEND_URL` in `.env`
4. ❌ If you get 404, verify callback URL in Facebook Console

### Test 7: Complete Login (Existing User)
1. Use same Facebook account as Test 6
2. ✅ Should redirect to: `https://serag-eldien.site/auth/callback?token=<JWT>`
3. ✅ Token should be different from Test 6 (new token generated)

### Test 8: Email Conflict
1. First create a local account with email: `fb@example.com`
2. Try to login with Facebook using same email
3. ✅ Should redirect to: `https://serag-eldien.site/auth/callback?error=auth_failed&message=Email%20already%20registered%20using%20local...`

## Frontend Integration Testing

### Test 9: Button Click from Frontend
Your frontend should have:
```javascript
const handleGoogleLogin = () => {
  window.location.href = 'https://serag-eldien.site/api/auth/google';
};

const handleFacebookLogin = () => {
  window.location.href = 'https://serag-eldien.site/api/auth/facebook';
};
```

### Test 10: Callback Handler
Your frontend needs a route at `/auth/callback`:
```typescript
// Example: /auth/callback page
const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    
    if (token) {
      // Store token
      localStorage.setItem('access_token', token);
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else if (error) {
      // Show error
      alert(decodeURIComponent(searchParams.get('message')));
      window.location.href = '/login';
    }
  }, []);
  
  return <div>Processing...</div>;
};
```

## Backend Logs to Check

When OAuth succeeds, you should see:
```
[UserAuthController] Facebook OAuth callback - user email: user@example.com
[FrontendRedirectService] OAuth redirect URL: https://serag-eldien.site/auth/callback
[UserAuthController] Redirecting to: https://serag-eldien.site/auth/callback?token=***
```

When OAuth fails, you should see:
```
[UserAuthController] Facebook OAuth login failed: Email already registered using local. Please login using that method.
[FrontendRedirectService] OAuth error redirect URL: https://serag-eldien.site/auth/callback?error=auth_failed&message=...
```

## Troubleshooting

### Problem: Redirect goes to facebook.com or google.com
**Cause**: `FRONTEND_URL` not set or server not restarted
**Fix**: 
1. Add `FRONTEND_URL=https://serag-eldien.site` to `.env`
2. Restart server
3. Clear browser cache

### Problem: 404 Error from OAuth provider
**Cause**: Callback URL mismatch
**Fix**:
1. Check `BASE_URL` in `.env` = `https://serag-eldien.site`
2. Check callback URL in provider console = `https://serag-eldien.site/api/auth/google/callback`
3. Make sure URLs match EXACTLY (no trailing slash, correct protocol)

### Problem: "redirect_uri_mismatch"
**Cause**: Callback URL not registered
**Fix**: Add the callback URL to your OAuth provider console

### Problem: CORS Error
**Cause**: Frontend domain not allowed
**Fix**: Check CORS configuration in `src/main.ts`

## Quick Debug Commands

```bash
# Check environment variables
cat .env | grep -E "(BASE_URL|FRONTEND_URL)"

# Test OAuth endpoints
curl -I https://serag-eldien.site/api/auth/google
curl -I https://serag-eldien.site/api/auth/facebook

# Check if backend is running
curl https://serag-eldien.site/api

# View server logs (adjust based on your setup)
pm2 logs
# or
docker logs <container-name>
# or
tail -f logs/app.log
```

## Success Criteria

All tests should pass with ✅:
- [ ] Google login creates new user
- [ ] Google login works for existing user
- [ ] Google login handles email conflicts
- [ ] Facebook login creates new user
- [ ] Facebook login works for existing user
- [ ] Facebook login handles email conflicts
- [ ] Redirects go to `serag-eldien.site/auth/callback` (NOT facebook.com or google.com)
- [ ] Frontend receives token or error correctly
- [ ] Frontend can store token and authenticate user

## Notes

- The error message "Email already registered using local" is EXPECTED when a user tries to use OAuth with an email that was registered via traditional signup
- OAuth redirects ALWAYS go to `FRONTEND_URL` from `.env`, never rely on referer headers
- Tokens are JWT and expire based on `JWT_EXPIRATION_TIME` in `.env`
