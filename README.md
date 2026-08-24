# Last-Mile Delivery Tracker

A full-stack, role-based last-mile delivery management system built with **FastAPI** and **Next.js**. It covers the complete delivery lifecycle—pricing, order creation, agent dispatch, GPS tracking, failure handling, and rescheduling—across three distinct portals.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Setup](#setup)
4. [Running the Backend](#running-the-backend)
5. [Running the Frontend](#running-the-frontend)
6. [Environment Variables](#environment-variables)
7. [Database Initialization & Seed](#database-initialization--seed)
8. [API Overview](#api-overview)
9. [Database Schema Overview](#database-schema-overview)
10. [Rate Calculation](#rate-calculation)
11. [Running Tests](#running-tests)
12. [Deployment Notes](#deployment-notes)

---

## Project Overview

The system handles the full lifecycle of a parcel delivery:

| Stage | Description |
|-------|-------------|
| **Quote** | Customer requests deterministic price quote (volumetric vs actual weight) |
| **Order** | Customer confirms order, freezing an immutable price snapshot |
| **Dispatch** | Admin triggers auto (Haversine-nearest) or manual agent assignment |
| **Delivery** | Agent progresses order: PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED |
| **Failure** | Agent marks FAILED → system auto-queues AWAITING_RESCHEDULE → customer reschedules |
| **Tracking** | Append-only, immutable tracking events record every status change with actor and timestamp |

Three portals: **Customer**, **Delivery Agent**, and **Admin Control Centre**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI 0.11, Python 3.11 |
| ORM | SQLAlchemy 2.x |
| DB (dev) | SQLite (file-based), trivially swappable to PostgreSQL |
| Migrations | Alembic |
| Auth | JWT (python-jose), bcrypt |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Tests | pytest, FastAPI TestClient, SQLite in-memory |

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- `pip` and `npm`

### Clone

```bash
git clone https://github.com/<your-org>/last-mile-delivery-tracker.git
cd last-mile-delivery-tracker
```

---

## Running the Backend

```bash
cd backend

# 1. Create a virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy environment file
cp ../.env.example .env
# Edit .env with your SECRET_KEY

# 4. Start the development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

---

## Running the Frontend

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Copy environment file and set the backend URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 3. Start the development server
npm run dev
```

The frontend will be available at `http://localhost:3000`.

---

## Environment Variables

Copy `.env.example` to `backend/.env` and fill in:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///./delivery_tracker.db` |
| `SECRET_KEY` | JWT signing secret (change in production!) | `dev-secret-key` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT lifetime in minutes | `1440` |

Frontend environment (`.env.local`):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL |

---

## Database Initialization & Seed

```bash
cd backend

# Create tables (Alembic migrations)
alembic upgrade head

# Seed with zones, areas, rate cards, users, and agents
python -c "from app.seed import seed_database; from app.database import SessionLocal; seed_database(SessionLocal())"
```

The seed creates:
- 3 Bengaluru zones (South, Central, East) with 12 postal code areas
- 1 active rate card with B2B/B2C weight-band pricing rules + COD surcharges
- 1 admin user, 1 customer, 2 delivery agents (credentials printed to console)

---

## API Overview

| Group | Base Path | Auth Required |
|-------|-----------|--------------|
| Auth | `/auth` | No (register/login) |
| Customer Orders | `/orders` | CUSTOMER JWT |
| Tracking | `/orders/{id}/tracking` | Any authenticated |
| Pricing | `/pricing` | CUSTOMER JWT |
| Agent Ops | `/agent` | DELIVERY_AGENT JWT |
| Admin | `/admin` | ADMIN JWT |
| Notifications | `/notifications` | ADMIN JWT |
| Zones | `/zones` | Public |

Key endpoints:

```
POST /auth/register          → Create CUSTOMER account
POST /auth/login             → Returns JWT
GET  /auth/me                → Current user

POST /orders                 → Create order
POST /orders/{id}/confirm    → Freeze price snapshot
GET  /orders                 → List my orders (returns { orders, total })
GET  /orders/{id}/tracking   → Tracking timeline (returns { order_id, events })
POST /orders/{id}/reschedule → Request reschedule (triggers auto-assignment)

GET  /pricing/quote          → Get price quote

GET  /agent/profile          → Agent profile
GET  /agent/assignments      → Active assignments (flat objects)
POST /agent/availability     → Update status { status: "AVAILABLE" }
POST /agent/location         → Ping GPS coordinates
POST /agent/orders/{id}/pickup
POST /agent/orders/{id}/in-transit
POST /agent/orders/{id}/out-for-delivery
POST /agent/orders/{id}/deliver
POST /agent/orders/{id}/fail

GET  /admin/orders?status=&zone_id=&agent_id=
POST /admin/orders/{id}/auto-assign
POST /admin/orders/{id}/assign
POST /admin/orders/{id}/override-status
GET  /admin/agents
POST /notifications/process  → Manual notification retry (admin)
```

---

## Database Schema Overview

```
users ──────────────┬── customer_profiles
                    └── agents ──── agent_locations
                                    assignments
zones ──── areas

rate_card_versions ─┬── rate_rules
                    └── cod_rules

orders ─────────────┬── order_price_snapshots
                    ├── delivery_attempts ──── assignments
                    ├── tracking_events
                    ├── reschedule_requests
                    └── notification_outbox
```

---

## Rate Calculation

1. **Volumetric weight** = `L × B × H / 5000` (cm³ → kg)
2. **Billable weight** = `max(actual_weight, volumetric_weight)`
3. **Movement type** = INTRA_ZONE (same zone) or INTER_ZONE (different zone)
4. **Rate rule lookup**: find the active rate card row matching `(order_type, movement_type, min_weight ≤ billable ≤ max_weight)`
5. **Charges**:
   - Base charge (flat) + Weight charge (`billable_weight × per_kg_charge`)
   - COD surcharge (if `payment_type = COD`)
6. **Active rate card**: must satisfy `is_active=True`, `effective_from ≤ now`, and `effective_to IS NULL OR effective_to > now`

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

The test suite uses an in-memory SQLite database seeded fresh for each test function. No external services are required.

Tests cover:
- Pricing engine (volumetric weight, inter-zone COD, invalid postal codes)
- State machine (valid and illegal transitions)
- Dispatch engine (nearest agent selection)
- Tracking events (append-only audit log)
- **Regression tests** (`tests/test_fixes.py`):
  - Public registration security
  - Future/expired rate card exclusion
  - Dimension validation (zero/negative rejected)
  - Two-step FAILED→AWAITING_RESCHEDULE lifecycle
  - Assignment closure on delivery and failure
  - Reschedule creates new attempt + attempts auto-assignment
  - Admin agent_id filter
  - Agent profile endpoint
  - Availability payload field name

---

## Deployment Notes

- **Database**: Replace `sqlite:///./delivery_tracker.db` with a PostgreSQL URL in `DATABASE_URL`. Run `alembic upgrade head` on first deploy.
- **Secret key**: Set a strong random `SECRET_KEY` (e.g. `openssl rand -hex 32`).
- **Notifications**: The `EmailProvider` and `SMSProvider` in `backend/app/notifications/providers.py` are console stubs. Swap in SMTP/SendGrid (email) and Twilio (SMS) credentials via environment variables before going live.
- **CORS**: Update `allow_origins` in `backend/app/main.py` to your production frontend URL.
- **Frontend**: Run `npm run build` then serve the `.next` output with a Node server or deploy to Vercel.
- **Do not commit**: `.env`, `node_modules/`, `.next/`, `delivery_tracker.db`, `__pycache__/`, `.pytest_cache/`.
