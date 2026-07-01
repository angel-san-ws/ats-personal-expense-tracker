# ATS Personal Expense Tracker

A full-stack web app to **import bank/credit-card statements from Excel**, store the
transactions locally, **filter and visualize** them in a dashboard, and **categorize**
every merchant / expense concept.

Built with the latest compatible stack:

| Layer | Tech |
|-------|------|
| Frontend | **Angular 21** (standalone, signals, zoneless) + **PrimeNG 21** (Aura theme) + Chart.js |
| i18n | **Transloco** — English (default) + Spanish, switchable at runtime |
| Backend | **NestJS 11** + **TypeORM 1** |
| Database | **PostgreSQL 16** (via Docker) |
| Excel parsing | **SheetJS (`xlsx`)** — reads legacy `.xls`, `.xlsx` and `.csv` |
| Auth | JWT (access token) + bcrypt |

---

## Features

- **Register / Login** — JWT auth; each account has its own isolated data.
- **Import** — upload an Excel/CSV statement. The parser auto-detects the transaction
  header row (`FECHA`, `COMERCIO`, `VALOR`, …), reads statement metadata (cardholder,
  card number, credit/available limits, statement & payment dates) and stores every row.
- **Filter** everywhere by **date range, card, merchant/concept, category, and free-text search**.
- **Dashboard** — KPIs (total spend, count, average, top merchant) + charts: spend by
  category (doughnut), spend over time, spend by card, top merchants.
- **Expenses** — server-side paginated, sortable, filterable table.
- **Categories** — a CRUD catalog (with colors). A default set is seeded on registration.
- **Expense Concepts** — every distinct `COMERCIO` becomes a *concept* you can assign to
  a category; the dashboard and filters roll up by that category.
- **Settings** — edit profile, change password, switch **language** (EN/ES) and **currency**.

---

## Prerequisites

- **Node.js ≥ 22.12** (developed on Node 24 LTS). If you use `nvm-windows`: `nvm use 24.18.0`.
- **Docker Desktop** (for PostgreSQL).

> The Postgres container publishes host port **5433** (not the default 5432) to avoid
> clashing with any local Postgres install. This is already configured in
> `docker-compose.yml` and `backend/.env`.

---

## Running the app

Open three terminals from the project root.

### 1. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 16 on `localhost:5433` (db `ats_expenses`, user `ats`,
password `ats_password`). Data persists in a Docker volume.

### 2. Start the backend (API on http://localhost:3000/api)

```bash
cd backend
npm install
npm run start:dev
```

TypeORM `synchronize` auto-creates the schema on first run.

### 3. Start the frontend (UI on http://localhost:4200)

```bash
cd frontend
npm install
npm start
```

Then open **http://localhost:4200**, register an account, and go to **Import** to upload
a statement.

---

## Typical workflow

1. **Register** → you get a default set of categories (Food & Dining, Groceries,
   Transport, Fuel, Shopping, Entertainment, Health, Services, Other).
2. **Import** an Excel statement → transactions are stored and each distinct merchant
   becomes an uncategorized *concept*.
3. Go to **Expense Concepts** → assign each merchant to a category from the dropdown.
4. Explore the **Dashboard** and **Expenses** with the filter bar.
5. Manage your catalog under **Categories**; change language/currency under **Settings**.

---

## Project layout

```
ATS Personal Expense Tracker/
├─ docker-compose.yml         # PostgreSQL 16 (host port 5433)
├─ backend/                   # NestJS API
│  ├─ .env                    # DB + JWT + CORS config
│  └─ src/
│     ├─ auth/                # register / login / JWT
│     ├─ users/               # profile + settings (language, currency, password)
│     ├─ categories/          # category catalog CRUD
│     ├─ concepts/            # merchant → category assignment
│     ├─ expenses/            # filtering + dashboard aggregates
│     └─ import/              # Excel parser + import pipeline
└─ frontend/                  # Angular + PrimeNG
   ├─ public/i18n/            # en.json / es.json
   └─ src/app/
      ├─ core/                # auth, http services, models, i18n, currency pipe
      ├─ layout/              # top bar (nav, language switch, user menu)
      └─ features/            # auth, dashboard, expenses, import, categories,
                              #   concepts, settings
```

---

## API overview (all under `/api`, JWT-protected except auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/register` `/auth/login` | Auth (returns access token + user) |
| GET  | `/auth/me` | Current user |
| POST | `/import/excel` | Upload a statement (multipart `file`) |
| GET  | `/import/batches` | Import history |
| GET  | `/expenses` | Filtered + paginated expenses |
| GET  | `/expenses/summary` | Dashboard aggregates |
| GET  | `/expenses/cards` | Distinct cards (for filters) |
| GET/POST/PATCH/DELETE | `/categories` | Category catalog CRUD |
| GET  | `/concepts` | Concepts with stats + category |
| PATCH | `/concepts/:id/category` | Assign a concept to a category |
| PATCH | `/users/me/profile` `/users/me/settings` | Update profile / preferences |
| PUT  | `/users/me/password` | Change password |

---

## Notes

- Amounts are parsed from formats like `Q. 27,561.01` and stored as numeric values.
- `synchronize: true` is convenient for local dev; switch to TypeORM migrations before
  any production use, and change `JWT_SECRET` / DB credentials in `backend/.env`.
- To stop the database: `docker compose down` (add `-v` to also delete the data volume).
