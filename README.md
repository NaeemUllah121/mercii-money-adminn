# Mercii Admin Panel

A comprehensive admin dashboard for managing UK-to-Pakistan remittance operations.

## Features

- **Authentication**: JWT + MFA (TOTP) with RBAC (Admin, MLRO, Support, Viewer)
- **Dashboard**: Real-time KPIs, service health monitoring, alerts
- **Customer Management**: Search, profile view, KYC/AML, limits, beneficiaries
- **Compliance**: MLRO flags with SLA tracking, approve/reject/hold actions
- **Operations**: Transaction management, reconciliation, CSV export, webhooks, background jobs
- **Business Logic**: Monthly caps (£5k), bonus system (#4/#8/#12), RDA rules

## Tech Stack

### Backend
- Node.js + Express.js
- Sequelize ORM + PostgreSQL
- JWT authentication + bcrypt
- Speakeasy for MFA
- Axios for external service health checks

### Frontend
- React 18 + TypeScript
- TailwindCSS for styling
- React Router v6
- Recharts for charts
- Axios for API communication

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- Git

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd mercii-admin-panel
```

2. Install dependencies
```bash
# Backend
cd Mercii-Backend
npm install

# Frontend
cd ../mercii-admin
npm install
```

3. Set up environment variables
```bash
# Backend (.env)
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=usi_db_1
JWT_SECRET_KEY=your-secret-key
USI_BASE_URL=https://test4.remit.by/universalsecuritiestest/ws/
SHUFTI_URL=https://api.shuftipro.com
DILISENSE_URL=https://api.dilisense.com/v1
SEND_GRID_API_KEY=your-sendgrid-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
WEB_HOOK_URL=http://localhost:3001/api/v1

# Frontend (mercii-admin/.env)
REACT_APP_API_URL=http://localhost:3001/api/v1
PORT=3000
```

4. Set up database
```bash
cd Mercii-Backend
npx sequelize-cli db:migrate
npx sequelize-cli db:seed --seed 20240101000001-create-default-admin.js
npx sequelize-cli db:seed --seed 20240102000001-seed-sample-data.js
```

5. Start the servers
```bash
# Backend (port 3001)
cd Mercii-Backend
npm start

# Frontend (port 3000)
cd ../mercii-admin
npm start
```

6. Access the application
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/v1

## Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | Admin123!@# | Admin (full access) |
| mlro | MLRO123!@# | MLRO (compliance) |
| support | Support123!@# | Support (customer management) |
| viewer | Viewer123!@# | Viewer (read-only) |

## Project Structure

```
mercii-admin-panel/
├── Mercii-Backend/          # Node.js backend
│   ├── src/
│   │   ├── controllers/     # API controllers
│   │   ├── models/         # Sequelize models
│   │   ├── routes/         # API routes
│   │   ├── middlewares/    # Auth, RBAC, audit logging
│   │   ├── services/       # Business logic
│   │   ├── migrations/     # DB migrations
│   │   └── seeders/        # Sample data
│   └── package.json
├── mercii-admin/           # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service layer
│   │   └── context/        # Auth context
│   └── package.json
├── PROJECT_SUMMARY.txt     # Technical documentation
└── HOW_IT_WORKS.txt       # Detailed guide
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login with MFA
- `POST /auth/logout` - Logout
- `GET /auth/profile` - Get admin profile
- `POST /auth/change-password` - Change password

### Overview
- `GET /overview/kpis` - Dashboard KPIs
- `GET /overview/health` - Service health status
- `GET /overview/alerts` - Recent alerts

### Customers
- `GET /customers` - List customers
- `GET /customers/:id` - Customer profile
- `POST /customers/:id/suspend` - Suspend customer
- `POST /customers/:id/resend-kyc` - Resend KYC

### Compliance
- `GET /compliance/mlro-flags` - MLRO flags with SLA
- `POST /compliance/mlro-flags/:id/approve` - Approve flag
- `POST /compliance/mlro-flags/:id/reject` - Reject flag
- `POST /compliance/mlro-flags/:id/hold` - Hold flag

### Operations
- `GET /operations/reconciliation` - Daily reconciliation
- `GET /operations/reconciliation/export` - CSV export
- `GET /operations/webhooks` - Webhook status
- `GET /operations/jobs` - Background jobs

## Business Logic

### Monthly Transfer Caps
- £5,000 per customer per month
- Month based on customer's registration day (anchor day)
- Resets on anchor day each month

### Bonus System
- Transfer #4: +500 PKR
- Transfer #8: +700 PKR  
- Transfer #12: +1000 PKR
- Conditions: ≥ £85, non-RDA, 24h gap to same beneficiary
- Cycle resets after #12 on next anchor day

### RDA (Roshan Digital Account)
- Beneficiaries with type='my_self' are RDA accounts
- RDA transfers allowed but excluded from bonus calculation
- Still count toward monthly transfer cap

## Deployment

### Render.com
1. Create PostgreSQL database on Render
2. Create backend web service (Node.js)
3. Create frontend static site (React)
4. Set environment variables
5. Run migrations and seeders

### Environment Variables for Production
```bash
# Database
DB_HOST=your-render-db-host
DB_USER=your-render-db-user
DB_PASSWORD=your-render-db-password
DB_NAME=your-render-db-name

# APIs
USI_BASE_URL=https://production-usi-api.com/ws/
WEB_HOOK_URL=https://your-app.onrender.com/api/v1

# Frontend
REACT_APP_API_URL=https://your-backend.onrender.com/api/v1
```

## Documentation

- `PROJECT_SUMMARY.txt` - Complete technical summary
- `HOW_IT_WORKS.txt` - Detailed guide explaining every feature

## License

Private - © Mercii Money
