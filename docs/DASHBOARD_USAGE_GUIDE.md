# 📊 Dashboard System - Complete Usage Guide

## 🚀 Quick Start

### 1. Authentication

First, authenticate as an admin (SUPER or MANAGER):

```bash
# Login as admin
curl -X POST http://localhost:3000/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@englishom.com",
    "password": "your_password"
  }'
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "admin_id",
    "email": "superadmin@englishom.com",
    "role": "ADMIN"
  }
}
```

Save the `access_token` for subsequent requests.

## 📈 Dashboard Endpoints

### 1. **Get Dashboard Statistics**

Get comprehensive overview statistics for the admin dashboard main page.

```bash
curl -X GET http://localhost:3000/dashboard/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**

```json
{
  "overview": {
    "totalUsers": 1250,
    "totalActiveUsers": 1100,
    "totalSuspendedUsers": 120,
    "totalBlockedUsers": 30,
    "totalRevenue": 25000.5,
    "totalSubscribedUsers": 800,
    "totalCourses": 6
  },
  "recentActivity": {
    "recentOrders": [
      {
        "userId": "user_id",
        "levelName": "INTERMEDIATE",
        "amountCents": 15000,
        "paymentDate": "2025-06-22T10:30:00Z"
      }
    ],
    "userGrowthData": [
      {
        "_id": { "year": 2025, "month": 6 },
        "count": 45
      }
    ]
  },
  "analytics": {
    "revenueByMonth": [
      {
        "_id": { "year": 2025, "month": 6 },
        "revenue": 500000,
        "orders": 35
      }
    ],
    "coursePopularity": [
      {
        "_id": "INTERMEDIATE",
        "purchases": 250,
        "revenue": 375000
      }
    ]
  },
  "generatedAt": "2025-06-22T12:00:00Z"
}
```

### 2. **Get User Details**

Get detailed information about a specific user for course assignment or management.

```bash
curl -X GET http://localhost:3000/dashboard/user-details/USER_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**

```json
{
  "user": {
    "id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "status": "ACTIVE",
    "createdAt": "2025-01-15T09:00:00Z",
    "lastActivity": "2025-06-22T08:30:00Z"
  },
  "completedCourses": [
    {
      "levelName": "BEGINNER",
      "purchaseDate": "2025-02-01T10:00:00Z"
    },
    {
      "levelName": "INTERMEDIATE",
      "purchaseDate": "2025-04-15T14:30:00Z"
    }
  ],
  "totalCoursesOwned": 2
}
```

### 3. **Search Users**

Search for users by name or email with pagination support.

```bash
# Basic search
curl -X GET "http://localhost:3000/dashboard/search-users?query=john&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Search with pagination
curl -X GET "http://localhost:3000/dashboard/search-users?query=example.com&page=2&limit=5" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**

```json
{
  "data": [
    {
      "id": "user_id_1",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "status": "ACTIVE",
      "createdAt": "2025-01-15T09:00:00Z",
      "lastActivity": "2025-06-22T08:30:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```

### 4. **Get Paginated Users**

Get a paginated list of all users for dashboard management.

```bash
curl -X GET "http://localhost:3000/dashboard/users?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 🎯 Frontend Integration Examples

### React/JavaScript Frontend Integration

```javascript
// Dashboard API Service
class DashboardService {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async getDashboardStats() {
    const response = await fetch(`${this.baseURL}/dashboard/stats`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  }

  async searchUsers(query, page = 1, limit = 10) {
    const response = await fetch(
      `${this.baseURL}/dashboard/search-users?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return response.json();
  }

  async getUserDetails(userId) {
    const response = await fetch(
      `${this.baseURL}/dashboard/user-details/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return response.json();
  }
}

// Usage in React Component
function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const dashboardService = new DashboardService(
          'http://localhost:3000',
          localStorage.getItem('adminToken'),
        );
        const data = await dashboardService.getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="dashboard">
      <div className="stats-overview">
        <div className="stat-card">
          <h3>Total Users</h3>
          <p>{stats.overview.totalUsers}</p>
        </div>
        <div className="stat-card">
          <h3>Active Users</h3>
          <p>{stats.overview.totalActiveUsers}</p>
        </div>
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <p>${stats.overview.totalRevenue}</p>
        </div>
      </div>
    </div>
  );
}
```

## 🔍 Advanced Usage Patterns

### 1. **Real-time Dashboard Updates**

```javascript
// Implement auto-refresh for dashboard stats
setInterval(async () => {
  const freshStats = await dashboardService.getDashboardStats();
  updateDashboard(freshStats);
}, 30000); // Refresh every 30 seconds
```

### 2. **Error Handling**

```javascript
try {
  const stats = await dashboardService.getDashboardStats();
} catch (error) {
  if (error.status === 403) {
    // Handle permission denied
    redirectToLogin();
  } else if (error.status === 401) {
    // Handle authentication failure
    refreshToken();
  } else {
    // Handle other errors
    showErrorMessage('Failed to load dashboard data');
  }
}
```

### 3. **Search with Debouncing**

```javascript
// Implement search with debouncing for better UX
const useDebounced = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

function UserSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const debouncedQuery = useDebounced(query, 500);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      searchUsers(debouncedQuery);
    }
  }, [debouncedQuery]);

  const searchUsers = async (searchQuery) => {
    const data = await dashboardService.searchUsers(searchQuery);
    setResults(data.data);
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Search users..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="search-results">
        {results.map((user) => (
          <div key={user.id} className="user-card">
            <h4>
              {user.firstName} {user.lastName}
            </h4>
            <p>{user.email}</p>
            <span className={`status ${user.status.toLowerCase()}`}>
              {user.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 📊 Dashboard Data Visualization

### Chart.js Integration Example

```javascript
import Chart from 'chart.js/auto';

function RevenueChart({ revenueData }) {
  useEffect(() => {
    const ctx = document.getElementById('revenueChart');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: revenueData.map((item) => `${item._id.year}-${item._id.month}`),
        datasets: [
          {
            label: 'Monthly Revenue',
            data: revenueData.map((item) => item.revenue / 100), // Convert cents to currency
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return '$' + value;
              },
            },
          },
        },
      },
    });
  }, [revenueData]);

  return <canvas id="revenueChart"></canvas>;
}
```

## 🚨 Error Codes & Troubleshooting

### Common Response Codes

- **200**: Success
- **400**: Bad Request (invalid query parameters)
- **401**: Unauthorized (invalid or expired token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found (user not found)
- **500**: Internal Server Error

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Search query must be at least 2 characters long",
  "error": "Bad Request"
}
```

## 🔧 Configuration & Environment

### Environment Variables

Make sure these are set in your `.env` file:

```env
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION_TIME=24h
DATABASE_URL=your_mongodb_connection_string
```

### Rate Limiting

The dashboard endpoints are subject to rate limiting:

- 100 requests per minute per IP
- Consider implementing client-side caching for better performance

## 🎯 Best Practices

1. **Always handle authentication errors gracefully**
2. **Implement loading states for better UX**
3. **Use debounced search to reduce API calls**
4. **Cache dashboard data appropriately**
5. **Implement proper error boundaries in React**
6. **Use TypeScript for better type safety**

## 🔄 Next Steps

1. **Implement real-time updates with WebSockets**
2. **Add export functionality for dashboard data**
3. **Create custom date range filters**
4. **Add more detailed analytics**
5. **Implement dashboard customization features**

---

## 📞 Support

If you encounter any issues with the dashboard:

1. Check the server logs for detailed error messages
2. Verify your admin token is valid and has proper permissions
3. Ensure you're using the correct API endpoints
4. Check network connectivity and CORS settings
