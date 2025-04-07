# Online Courses Backend

A robust backend system for managing online courses, built with NestJS and Prisma ORM. This project provides secure user authentication, course progress tracking, payment processing, and file uploads, ensuring a seamless learning experience.

## 🌟 Features

- **User Authentication**: Secure JWT-based authentication with support for Facebook and Google OAuth.
- **OTP Verification**: Email-based OTP handling for account verification.
- **Payment Integration**: Seamless payment processing with Paymob API.
- **Course Management**: Track user progress, completed tasks, and levels.
- **File Uploads**: Secure file uploads to AWS S3 with pre-signed URLs.
- **Admin Controls**: Role-based access for managing users and content.
- **Scalable Architecture**: Modular design for easy scalability and maintainability.

## 🛠 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Authentication**: [Passport.js](http://www.passportjs.org/) with JWT, Facebook, and Google strategies
- **File Storage**: [AWS S3](https://aws.amazon.com/s3/)
- **Payment Gateway**: [Paymob](https://paymob.com/)
- **Testing**: [Jest](https://jestjs.io/)
- **Deployment**: [Vercel](https://vercel.com)

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL instance
- AWS S3 bucket
- Paymob account

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=5000
JWT_SECRET=your_jwt_secret
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_S3_BUCKET=your_s3_bucket_name
PAYMOB_SECRET_KEY=your_paymob_secret_key
PAYMOB_PUBLIC_KEY=your_paymob_public_key
PAYMOB_INTEGRATION_ID=your_paymob_integration_id
```

### Installation

1. Clone the repository:

```bash
git clone https://github.com/itzSerag/Online_Courses_Backend.git
cd Online_Courses_Backend
```

2. Install dependencies:

```bash
npm install
```

3. Run database migrations:

```bash
npx prisma migrate dev
```

4. Start the development server:

```bash
npm run start:dev
```

The server will start on http://localhost:5000/api.

## 📄 API Documentation

### Authentication Endpoints

- `POST /api/auth/signup`: Register a new user
- `POST /api/auth/login`: Login user
- `POST /api/auth/reset-password`: Reset user password
- `POST /api/auth/verify-otp`: Verify OTP for account activation
- `POST /api/auth/logout`: Logout user

### User Endpoints

- `GET /api/users/me`: Get current user details
- `GET /api/users/all`: Get all users (Admin only)
- `POST /api/users/complete-day`: Mark a day as completed
- `POST /api/users/complete-task`: Mark a task as completed

### Payment Endpoints

- `POST /api/payment/process-payment`: Process a payment
- `POST /api/payment/refund`: Refund a payment
- `POST /api/payment/callback`: Handle payment callback

### Upload Endpoints

- `POST /api/files`: Upload course content
- `GET /api/files`: Retrieve course content
- `DELETE /api/files`: Delete course content

## 🔌 WebSocket Events

- `connection`: Client connects to WebSocket server
- `disconnect`: Client disconnects from WebSocket server

## 🔗 Related Repositories

- Frontend Repository: [Online Courses Frontend](https://github.com/itzSerag/Online_Courses_Frontend)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

- [@itzSerag](https://github.com/itzSerag)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/itzSerag/Online_Courses_Backend/issues).

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
