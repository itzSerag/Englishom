# Frontend Implementation Guide

## ⚠️ **IMPORTANT: OAuth is ONLY for Users, NOT Admins**

- **Admin Portal**: Only uses email/password login (no OAuth)
- **User Portal**: Uses email/password + Google/Facebook OAuth

## Required: Auth Callback Page (USER PORTAL ONLY)

Only the **User Portal** needs an `/auth/callback` page since admins don't use OAuth.

### **User Portal** (`https://vite-tanstack-router.vercel.app`)

Create: `/auth/callback` page

```typescript
// src/routes/auth/callback.tsx (TanStack Router) or equivalent
import { useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';

const AuthCallback = () => {
  const navigate = useNavigate();
  const search = useSearch({ from: '/auth/callback' });

  useEffect(() => {
    const { token, error, message } = search;

    if (token) {
      // SUCCESS: Store token and redirect to user dashboard
      localStorage.setItem('userToken', token);
      navigate({ to: '/dashboard' });
    } else if (error) {
      // ERROR: Show error message
      console.error('OAuth Error:', message);
      navigate({
        to: '/login',
        search: { error, message }
      });
    } else {
      // No token or error, redirect to login
      navigate({ to: '/login' });
    }
  }, [search]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div>Processing authentication...</div>
    </div>
  );
};

export default AuthCallback;
```

## Authentication Methods

### **Admin Portal** - Email/Password Only

Admins use traditional email/password authentication:

```typescript
// Admin portal login page
const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const response = await fetch('https://serag-eldien.site/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.access_token) {
        localStorage.setItem('adminToken', data.access_token);
        // Redirect to admin dashboard
        router.push('/en/admin/dashboard');
      }
    } catch (error) {
      console.error('Admin login failed:', error);
    }
  };

  return (
    <div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Admin Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button onClick={handleLogin}>
        Login as Admin
      </button>
      {/* NO OAuth buttons for admin */}
    </div>
  );
};
```

### **User Portal** - Email/Password + OAuth

```typescript
// User portal login page
const UserLogin = () => {
  const handleGoogleLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = 'https://serag-eldien.site/api/auth/google';
  };

  const handleFacebookLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = 'https://serag-eldien.site/api/auth/facebook';
  };

  return (
    <div>
      <button onClick={handleGoogleLogin}>
        Login with Google
      </button>
      <button onClick={handleFacebookLogin}>
        Login with Facebook
      </button>
    </div>
  );
};
```

## How The Magic Works

1. **User on Admin Portal** clicks "Login with Google"
2. **Browser navigates** to: `https://serag-eldien.site/api/auth/google`
3. **Browser automatically sends** Referer: `https://english-home.vercel.app/en/admin/login`
4. **Backend sees** the referer and knows this is an admin user
5. **After OAuth success**, backend redirects to: `https://english-home.vercel.app/auth/callback?token=JWT`
6. **Admin portal** `/auth/callback` page receives the token and redirects to admin dashboard

Same process works for the user portal, but redirects to user portal URLs.

## Testing

### Test Admin Portal OAuth:

1. Go to: `https://english-home.vercel.app/en/admin/login`
2. Click "Login with Google/Facebook"
3. Should return to: `https://english-home.vercel.app/auth/callback?token=...`

### Test User Portal OAuth:

1. Go to: `https://vite-tanstack-router.vercel.app/login`
2. Click "Login with Google/Facebook"
3. Should return to: `https://vite-tanstack-router.vercel.app/auth/callback?token=...`

## ⚠️ Important Notes

- **No Google/Facebook config changes needed** - your current OAuth apps work as-is
- **Backend callback URLs stay the same** - `https://serag-eldien.site/api/auth/google/callback`
- **The smart redirecting happens in the backend** based on the Referer header
- **Both frontends need the `/auth/callback` page** to handle the redirects
