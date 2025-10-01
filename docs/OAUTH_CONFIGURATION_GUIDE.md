# OAuth Configuration Guide

## Overview
This guide helps you configure Google and Facebook OAuth for your application.

## Environment Variables

Make sure these are set in your `.env` file:

```env
# Backend URL
BASE_URL=https://serag-eldien.site

# Frontend URL (for redirects after OAuth)
FRONTEND_URL=https://serag-eldien.site

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

## Google OAuth Setup

### 1. Go to Google Cloud Console
- Visit: https://console.cloud.google.com/

### 2. Create/Select a Project
- Create a new project or select an existing one

### 3. Enable Google+ API
- Go to "APIs & Services" > "Library"
- Search for "Google+ API"
- Click "Enable"

### 4. Configure OAuth Consent Screen
- Go to "APIs & Services" > "OAuth consent screen"
- Choose "External" user type
- Fill in:
  - App name: Your app name
  - User support email: Your email
  - Developer contact email: Your email
- Add scopes: `email`, `profile`
- Save and continue

### 5. Create OAuth 2.0 Credentials
- Go to "APIs & Services" > "Credentials"
- Click "Create Credentials" > "OAuth client ID"
- Choose "Web application"
- Add Authorized JavaScript origins:
  ```
  https://serag-eldien.site
  http://localhost:3000 (for local testing)
  ```
- Add Authorized redirect URIs:
  ```
  https://serag-eldien.site/api/auth/google/callback
  http://localhost:3000/api/auth/google/callback (for local testing)
  ```
- Click "Create"
- Copy your Client ID and Client Secret

## Facebook OAuth Setup

### 1. Go to Facebook Developers
- Visit: https://developers.facebook.com/

### 2. Create an App
- Click "My Apps" > "Create App"
- Choose "Consumer" type
- Fill in app details

### 3. Add Facebook Login Product
- In your app dashboard, click "Add Product"
- Select "Facebook Login" > "Set Up"
- Choose "Web"

### 4. Configure Facebook Login Settings
- Go to "Facebook Login" > "Settings"
- Add Valid OAuth Redirect URIs:
  ```
  https://serag-eldien.site/api/auth/google/callback
  http://localhost:3000/api/auth/google/callback (for local testing)
  ```
- Enable "Client OAuth Login"
- Enable "Web OAuth Login"
- Save changes

### 5. Get App Credentials
- Go to "Settings" > "Basic"
- Copy your App ID and App Secret

## Backend Endpoints

### Google OAuth Flow
1. **Initiate**: `GET /api/auth/google`
2. **Callback**: `GET /api/auth/google/callback`

### Facebook OAuth Flow
1. **Initiate**: `GET /api/auth/facebook`
2. **Callback**: `GET /api/auth/facebook/callback`

## Frontend Integration

### Initiating OAuth Login

```javascript
// Google Login
window.location.href = 'https://serag-eldien.site/api/auth/google';

// Facebook Login
window.location.href = 'https://serag-eldien.site/api/auth/facebook';
```

### Handling the Callback

After successful authentication, the user will be redirected to:
```
https://serag-eldien.site/auth/callback?token=<JWT_TOKEN>
```

On error:
```
https://serag-eldien.site/auth/callback?error=auth_failed&message=<ERROR_MESSAGE>
```

### Example React Component

```typescript
// OAuth Login Button
const handleGoogleLogin = () => {
  window.location.href = `${process.env.REACT_APP_API_URL}/auth/google`;
};

const handleFacebookLogin = () => {
  window.location.href = `${process.env.REACT_APP_API_URL}/auth/facebook`;
};

// Callback Handler Page
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (token) {
      // Store token
      localStorage.setItem('access_token', token);
      
      // Redirect to dashboard
      navigate('/dashboard');
    } else if (error) {
      // Show error
      console.error('OAuth Error:', message);
      navigate('/login', { 
        state: { error: message } 
      });
    }
  }, [searchParams, navigate]);

  return <div>Processing authentication...</div>;
};
```

## Testing

### 1. Check Callback URLs
Make sure the callback URLs in your OAuth provider match exactly:
- Google Console: `https://serag-eldien.site/api/auth/google/callback`
- Facebook Settings: `https://serag-eldien.site/api/auth/facebook/callback`

### 2. Test OAuth Flow
1. Go to your frontend
2. Click "Login with Google" or "Login with Facebook"
3. Verify you're redirected to the OAuth provider
4. Select an account/approve permissions
5. Verify you're redirected back to your frontend with a token

### 3. Check Backend Logs
When the server starts, you should see:
```
Google Strategy initialized with callback URL: https://serag-eldien.site/api/auth/google/callback
Facebook Strategy initialized with callback URL: https://serag-eldien.site/api/auth/facebook/callback
```

### 4. Debug Mode
Check your backend logs for:
```
OAuth redirect URL: ... (from referer: ...)
Redirecting to: .../auth/callback?token=***
```

## Common Issues

### Issue 1: "404 Not Found" from Google/Facebook
**Cause**: Callback URL mismatch
**Solution**: 
- Verify `BASE_URL` in `.env` is correct: `https://serag-eldien.site`
- Verify callback URLs in Google/Facebook console match exactly
- Restart your backend server after changing `.env`

### Issue 2: "redirect_uri_mismatch" Error
**Cause**: The redirect URI doesn't match what's registered
**Solution**:
- Check Google Console > Credentials > Your OAuth Client > Authorized redirect URIs
- Make sure it includes: `https://serag-eldien.site/api/auth/google/callback`
- No trailing slashes, exact match required

### Issue 3: "Email already registered using X"
**Cause**: User previously signed up with a different method
**Solution**: This is expected behavior. User should log in using the original method.

### Issue 4: Redirects to Facebook/Google instead of your site
**Cause**: Missing or incorrect `FRONTEND_URL` in `.env`
**Solution**: 
- Add `FRONTEND_URL=https://serag-eldien.site` to your `.env` file
- Restart your backend server
- The system now always uses `FRONTEND_URL` for OAuth redirects (doesn't rely on referer headers)

### Issue 5: CORS Errors
**Cause**: Frontend origin not allowed
**Solution**:
- Make sure CORS is enabled for your frontend domain
- Check `main.ts` CORS configuration

## Security Checklist

- [ ] Use HTTPS in production (both BASE_URL and FRONTEND_URL)
- [ ] Keep OAuth secrets secure (never commit to git)
- [ ] Limit OAuth redirect URIs to trusted domains only
- [ ] Validate user emails from OAuth providers
- [ ] Implement rate limiting on OAuth endpoints
- [ ] Log OAuth failures for security monitoring

## Troubleshooting Commands

```bash
# Check if environment variables are loaded
echo $BASE_URL
echo $FRONTEND_URL

# Test OAuth endpoints
curl https://serag-eldien.site/api/auth/google
curl https://serag-eldien.site/api/auth/facebook

# View backend logs
# (depends on your deployment setup)
```
