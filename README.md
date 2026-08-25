# Last-Mile Delivery Tracker

A full-stack, role-based last-mile delivery management system built with **FastAPI** (Python 3.11) and **Next.js 14** (TypeScript, Tailwind CSS). It covers the complete urban delivery lifecycle—serviceability checking, deterministic pricing, order creation, Haversine nearest-agent dispatching, real-time GPS tracking, audit timeline logs, failure handling, and customer-driven rescheduling—across three dedicated operations portals.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Setup](#setup)
4. [Running the Backend](#running-the-backend)
5. [Running the Frontend](#running-the-frontend)
6. [Demo Account Credentials](#demo-account-credentials)
7. [Environment Variables](#environment-variables)
8. [Database Initialization & Seed](#database-initialization--seed)
9. [API Overview](#api-overview)
10. [Serviceability & Error Contracts](#serviceability--error-contracts)
11. [Database Schema Overview](#database-schema-overview)
12. [Rate Calculation Engine](#rate-calculation-engine)
13. [Running Tests](#running-tests)
14. [Deployment Notes](#deployment-notes)

---

## Project Overview

The system handles the full end-to-end lifecycle of parcel deliveries in urban logistics:

| Stage | Description |
|-------|-------------|
| **Serviceability** | Validates pickup and drop 6-digit Indian PINs against configured Area and Zone databases |
| **Quote** | Customer requests deterministic price quote (comparing actual weight vs. volumetric weight `L×B×H/5000`) |
| **Order & Lock** | Order creation freezes an immutable price snapshot preventing rate card drift |
| **Dispatch** | Admin triggers automatic (nearest Haversine distance with load penalty) or manual agent assignment |
| **Delivery** | Agent executes status transitions: `PICKED_UP` → `IN_TRANSIT` → `OUT_FOR_DELIVERY` → `DELIVERED` |
| **Failure & Reschedule** | Delivery failure transitions `FAILED` → `AWAITING_RESCHEDULE`; customer selects new date up to 30 days ahead |
| **Audit Log** | Append-only immutable `TrackingEvent` records capture every status change with role, actor ID, and metadata |

Three dedicated portals:
- **Customer Portal**: Rate quote calculator, price snapshot locking, recent orders, search/filter archive, inline tracking audit timeline, order cancellation, and reschedule requests.
- **Delivery Agent Portal**: Availability status toggle, GPS location pinging, daily workload capacity tracking, and assigned task status execution.
- **Admin Control Center**: Active dispatch board, auto (Haversine) & manual agent assignment, status overrides, admin order creation, agent fleet management, postal code area mappings, zone CRUD, and rate card/COD rule configuration.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend API** | FastAPI 0.11, Python 3.11 |
| **ORM & Database** | SQLAlchemy 2.x, SQLite (WAL mode in dev), PostgreSQL ready |
| **Migrations** | Alembic |
| **Authentication** | JWT (python-jose), Passlib (bcrypt) |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS (Clean Neutral SaaS Light Theme) |
| **UI Icons** | Lucide React |
| **Test Suite** | Pytest, FastAPI TestClient, in-memory SQLite (69 automated tests) |

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- `pip` and `npm`

### Clone Repository
```bash
git clone https://github.com/Krishnansh-Kothiwal/last-mile-delivery-tracker.git
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

# 3. Start the development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API Base URL: `http://localhost:8000`
- Interactive OpenAPI Documentation: `http://localhost:8000/docs`

---

## Running the Frontend

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Configure API URL in .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 3. Start development server
npm run dev
```

- Frontend Console: `http://localhost:3000`

---

## Demo Account Credentials

The application is pre-seeded with verified demo accounts for testing all three portal roles. Quick-fill buttons are available on the `/login` page:

| Role | Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Customer** | `rahul@example.com` | `customer123` | Quotes, Order Creation, Tracking, Reschedule |
| **Delivery Agent** | `deepa@agent.com` | `agent123` | GPS Pings, Availability, Delivery Execution |
| **Admin** | `admin@deliverytracker.com` | `admin123` | Dispatch Board, Fleet, Zones, Rate Cards |

---

## Environment Variables

Copy `.env.example` to `backend/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///./delivery_tracker.db` |
| `SECRET_KEY` | JWT signing secret | `dev-secret-key` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiration time | `1440` (24 hours) |
| `EMAIL_PROVIDER` | Email dispatch mode (`console` or `smtp`) | `console` |
| `SMS_PROVIDER` | SMS dispatch mode (`console` or `twilio`) | `console` |

---

## Database Initialization & Seed

```bash
cd backend

# Apply Alembic migrations
alembic upgrade head

# Seed initial database
python -c "from app.seed import seed_database; from app.database import SessionLocal; seed_database(SessionLocal())"
```

The database seed populates:
- **5 Bengaluru Zones**: South, Central, East, North, West
- **50 Postal Code Mappings**: Covering major Bengaluru hubs (JP Nagar 560078, MG Road 560001, Whitefield 560066, Yelahanka 560064, Rajajinagar 560010, etc.)
- **10 Delivery Agents**: Distributed across all 5 zones with GPS coordinates and active capacity
- **3 Customer Users**: Rahul Sharma, Priya Patel, Amit Kumar
- **1 System Admin**: System Admin (`admin@deliverytracker.com`)
- **1 Active Rate Card**: Weight-band rules for B2C/B2B (INTRA_ZONE and INTER_ZONE) + COD surcharge rules

---

## Serviceability & Error Contracts

When quoting or creating orders, both pickup and drop 6-digit Indian PIN codes are validated against configured Area and Zone databases.

If a postal code is not mapped to an active Area and Zone, a structured error is returned:

```json
{
  "code": "UNSERVICEABLE_AREA",
  "field": "pickup_postal_code",
  "postal_code": "999999",
  "message": "We're not operational in this area yet."
}
```

Order creation, quote calculation, and agent assignment are strictly rejected for unserviceable PINs.

---

## API Overview

| Group | Base Path | Auth Required |
|-------|-----------|--------------|
| Auth | `/auth` | Public (`/register`, `/login`), JWT (`/me`) |
| Customer Orders | `/orders` | `CUSTOMER` JWT |
| Tracking Audit | `/orders/{id}/tracking` | Any Authenticated JWT |
| Pricing | `/pricing` | Public (`/quote`, `/rate-cards`) |
| Agent Ops | `/agent` | `DELIVERY_AGENT` JWT |
| Admin Console | `/admin` | `ADMIN` JWT |
| Notifications | `/notifications` | `ADMIN` JWT |

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

## Rate Calculation Engine

1. **Volumetric Weight**: `(Length × Breadth × Height) / 5000` (cm³ → kg)
2. **Billable Weight**: `max(actual_weight, volumetric_weight)`
3. **Movement Type**: `INTRA_ZONE` if pickup and drop PINs share the same zone; otherwise `INTER_ZONE`
4. **Rate Rule Selection**: Matches active rate card where `order_type`, `movement_type`, and `min_weight ≤ billable_weight ≤ max_weight`
5. **Total Price**:
   $$\text{Total Charge} = \text{Base Charge} + (\text{Billable Weight} \times \text{Per-Kg Charge}) + \text{COD Surcharge (if COD)}$$

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

The test suite includes **69 automated unit and regression tests** running against an in-memory SQLite database:
- `test_auth.py`: Authentication, JWT subject format, customer registration
- `test_serviceability.py`: PIN code serviceability validation & structured errors
- `test_pricing.py`: Volumetric weight calculation, rate card selection, COD surcharges
- `test_dispatch.py`: Haversine distance, agent eligibility, auto-assignment engine
- `test_agent_fleet.py`: Location updates, availability toggles, delivery attempts
- `test_tracking.py`: Immutable tracking events, audit log timeline
- `test_final_pass.py` & `test_fixes.py`: Regression coverage for order cancellation, reschedule date limits (max 30 days), snapshot freezing, and RBAC security.

---

## Deployment Notes

- **Database**: Set `DATABASE_URL` to a PostgreSQL connection string in production. Run `alembic upgrade head`.
- **Secret Key**: Generate a secure 256-bit random key for `SECRET_KEY`.
- **Frontend Build**: Run `npm run build` inside `frontend/` to produce static output.
- **Production Server**: Serve FastAPI backend with `uvicorn app.main:app --workers 4` or Gunicorn.
