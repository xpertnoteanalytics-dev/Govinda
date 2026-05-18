# Govinda AI

Production-grade multi-tenant healthcare SaaS foundation.

## Architecture

```
govinda-ai/
├── backend/          # Express + MongoDB + JWT API
│   └── src/
│       ├── config/       # Environment & database
│       ├── controllers/  # Route handlers
│       ├── middleware/   # Auth, tenant, RBAC, validation
│       ├── models/       # Mongoose schemas (User, Tenant)
│       ├── routes/       # API route definitions
│       ├── services/     # Business logic
│       ├── types/        # Shared types & Express augmentation
│       └── utils/        # JWT, errors
└── frontend/         # Next.js 15 + Tailwind CSS
    └── src/
        ├── app/          # App Router pages
        ├── components/   # UI, auth, dashboard
        └── lib/          # API client, auth helpers
```

## Features

- **Multi-tenant**: Each signup creates an isolated `Tenant` + admin `User`
- **JWT auth**: Access + refresh tokens with hashed refresh storage
- **RBAC**: `super_admin`, `tenant_admin`, `clinician`, `staff`, `viewer`
- **Middleware chain**: `authenticate` → `enforceTenantScope` → `requireRole`
- **Protected routes**: Next.js middleware + API `/api/v1/*`
- **Healthcare UI**: Teal clinical design system, responsive dashboard shell

## Quick start

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secrets (min 32 chars)
npm install
npm run dev
```

API runs at `http://localhost:4000`

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

App runs at `http://localhost:3000`

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service health |
| GET | `/api/health/ready` | DB readiness |
| POST | `/api/auth/signup` | Register org + admin |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh tokens |
| POST | `/api/auth/logout` | Logout (auth required) |
| GET | `/api/auth/me` | Current user (auth required) |
| GET | `/api/v1/dashboard` | Protected sample route |

## Environment variables

See `backend/.env.example` and `frontend/.env.example`.

## Roles

| Role | Level | Description |
|------|-------|-------------|
| `super_admin` | 100 | Platform-wide access |
| `tenant_admin` | 80 | Organization administrator |
| `clinician` | 60 | Clinical staff |
| `staff` | 40 | General staff |
| `viewer` | 20 | Read-only access |

## Next steps

- Add feature modules (patients, records, AI)
- HttpOnly cookie BFF layer in Next.js API routes
- Audit logging & HIPAA compliance controls
- Tenant invitation flows
