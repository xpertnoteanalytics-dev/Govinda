<<<<<<< HEAD
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
- **RBAC**: `super_admin`, `tenant_admin`, `clinician`, `staff`, `viewer` (product “staff member” = `staff`)
- **Middleware chain**: `authenticate` → `enforceTenantScope` → `requireRole`
- **Protected routes**: Next.js middleware + API `/api/v1/*`
- **AI agent (OpenAI)**: When `OPENAI_API_KEY` is set, chat uses GPT-4.1-class models with **function calling** (maps search, call scripts, Exotel dial, search history, call analytics, persistent memory). If unset, chat falls back to **Gemini**.
- **Find Care**: Google Places nearby search, history, analytics (`GOOGLE_MAPS_API_KEY`)
- **Calling (Exotel)**: Two-leg outbound Connect (`From` = staff/agent, `To` = facility), AI scripts (pharmacy / appointment / coordination), call logs, optional StatusCallback webhook for duration + recording (`EXOTEL_*` env vars)
- **Email outreach**: Provider-ready abstraction (Resend / SendGrid / log dev mode), AI drafts, tenant-scoped history (`EMAIL_*` env vars)
- **WhatsApp outreach**: Twilio / Meta / log dev mode, AI message templates, deep-link open-chat flow, delivery logging (`WHATSAPP_*` / `TWILIO_*` env vars)
- **Voice (ElevenLabs)**: Server-side TTS for avatar voice preview (`ELEVENLABS_API_KEY`)
- **Avatars (Anam + fallback)**: Conversational avatar session API (`ANAM_API_KEY` + persona agent IDs), with static fallback mode for resiliency
- **Operations dashboard**: Cross-module analytics (`/api/v1/operations/overview`)
- **Rate limiting**: In-memory limiter on `/api/v1/*` (tune `RATE_LIMIT_*`)
- **Healthcare UI**: Dark-first glassmorphism dashboard + theme toggle

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
| POST | `/api/v1/places/search` | Nearby healthcare places (auth) |
| GET | `/api/v1/places/history` | Tenant-scoped search history (auth) |
| DELETE | `/api/v1/places/history/:historyId` | Delete a history entry (auth) |
| GET | `/api/v1/places/analytics` | Search analytics by category (auth) |
| GET | `/api/v1/places/details/:placeId` | Place details (auth) |
| GET | `/api/v1/operations/overview` | AI + search + call + email + WhatsApp analytics (auth) |
| GET | `/api/v1/operations/outreach-config` | Company sender lines for email/WhatsApp (auth) |
| GET | `/api/v1/emails` | Email outreach log (auth) |
| GET | `/api/v1/emails/analytics` | Email metrics (auth) |
| POST | `/api/v1/emails/draft` | AI-generated email draft (auth) |
| POST | `/api/v1/emails/send` | Send outreach email (auth) |
| GET | `/api/v1/whatsapp` | WhatsApp message log (auth) |
| GET | `/api/v1/whatsapp/analytics` | WhatsApp metrics (auth) |
| POST | `/api/v1/whatsapp/draft` | AI-generated WhatsApp message (auth) |
| POST | `/api/v1/whatsapp/send` | Send via provider or open-chat deep link (auth) |
| GET | `/api/v1/calls` | Call log (auth) |
| GET | `/api/v1/calls/analytics` | Call metrics (auth) |
| POST | `/api/v1/calls/script` | AI-generated calling script (auth) |
| POST | `/api/v1/calls/initiate` | Start Exotel outbound call (auth); returns call record even if provider fails |
| POST | `/api/webhooks/exotel/call-status` | Exotel terminal StatusCallback (optional `?token=` if `EXOTEL_WEBHOOK_SECRET` set) |
| GET | `/api/v1/avatar/personas` | List avatar personas (auth) |
| GET | `/api/v1/avatar/settings` | User avatar selection (auth) |
| PATCH | `/api/v1/avatar/settings` | Update persona (auth) |
| POST | `/api/v1/avatar/session` | Anam avatar session with static fallback (auth) |
| POST | `/api/v1/voice/synthesize` | ElevenLabs TTS (auth) |

### Dashboard routes

| Path | Description |
|------|-------------|
| `/dashboard` | Overview + operations metrics |
| `/dashboard/chat` | AI assistant (tools when OpenAI configured) |
| `/dashboard/search` | Find Care — Places search |
| `/dashboard/avatar` | Govinda / Durga avatars, voice, Anam session |
| `/dashboard/calls` | Call history & analytics |
| `/dashboard/outreach` | Combined email, WhatsApp, and call history |

## Calling (Exotel)

Outbound calls use the [Exotel Connect API](https://developer.exotel.com/api/make-a-call-api): Exotel dials **`EXOTEL_FROM_NUMBER`** (or `agentPhone` in the API body) **first**, then connects the facility on **`To`**. **`EXOTEL_EXOPHONE`** is used as **`CallerId`**.

- Set **`EXOTEL_API_BASE`** to `https://api.in.exotel.com` (Mumbai) or `https://api.exotel.com` (Singapore) per your account.
- Set **`EXOTEL_STATUS_CALLBACK_URL`** to your public URL for  
  `POST /api/webhooks/exotel/call-status` (append `?token=...` if using **`EXOTEL_WEBHOOK_SECRET`**) so completed calls get **duration** and **recording** updates.

### Find Care (Google Maps)

Dashboard route: `/dashboard/search` — search pharmacies, hospitals, NGOs, and polyclinics by city or current location. Each result supports **Directions**, **Email**, **WhatsApp**, and **Call** actions with AI-generated drafts. Requires `GOOGLE_MAPS_API_KEY` on the backend (Places API + Geocoding API enabled in Google Cloud).

### Email & WhatsApp

- Set **`COMPANY_SUPPORT_EMAIL`** and **`COMPANY_WHATSAPP_NUMBER`** — all outreach sends **from** these company lines, not staff personal accounts.
- Default dev mode: `EMAIL_PROVIDER=log` and `WHATSAPP_PROVIDER=log` (records history without external APIs).
- Production email: set `EMAIL_PROVIDER=resend` or `sendgrid` plus company support email and the matching API key.
- Production WhatsApp: set `WHATSAPP_PROVIDER=twilio` or `meta`; API sends from the company WhatsApp line to the **facility phone** from Find Care.
- **Send from company** is the primary action; **Manual backup link** opens a facility-targeted deep link only when API send is unavailable (device WhatsApp may still apply).

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

- Wire full Anam browser SDK rendering in the avatar panel
- Harden Exotel webhooks (signature verification if Exotel provides it for your account)
- OpenAI **streaming** responses + STT for full voice loop
- Add feature modules (patients, records)
- Audit logging & HIPAA compliance controls
- Tenant invitation flows
=======
# Govinda_ai
>>>>>>> 5f6d19706ef61edf6d4944cad3ec0456d97b7d6e
#   G o v i n d a _ A I _  
 