# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A full-stack personal expense tracker: import bank/credit-card statements from Excel (`.xls`/`.xlsx`/`.csv`), store transactions in Postgres, filter/visualize them in a dashboard, and categorize merchants. Two independent npm projects (`backend/`, `frontend/`) — there is no root package.json; run npm commands inside each directory.

## Commands

```powershell
# Start everything (Docker Desktop + Postgres + backend + frontend in new windows)
.\run.ps1

# Or manually:
docker compose up -d          # PostgreSQL 16 on localhost:5433 (NOT 5432)

cd backend
npm run start:dev             # NestJS API on http://localhost:3000/api
npm run lint                  # eslint --fix
npm run build
npm test                      # jest (unit, *.spec.ts under src/)
npm test -- path/to/file.spec.ts   # single test file
npm run test:e2e

cd frontend
npm start                     # ng serve on http://localhost:4200
npm run build
npm test                      # ng test (vitest)
```

Backend config lives in `backend/.env` (DB on port **5433**, JWT secret, CORS origin). The DB schema is created by TypeORM `synchronize: true` — there are no migrations; entity changes apply on backend restart.

## Architecture

### Backend (NestJS 11 + TypeORM + PostgreSQL)

One module per domain under `backend/src/`: `auth`, `users`, `categories`, `concepts`, `expenses`, `import`, `recurring`. Each follows the standard pattern: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.entity.ts`, `dto.ts`. All routes are under the global `/api` prefix and JWT-protected (passport-jwt) except `/auth/register|login`; controllers get the user via the `@CurrentUser()` decorator. A global `ValidationPipe` runs with `whitelist` + `transform` (implicit conversion), so query/body DTOs in `dto.ts` define what actually reaches services.

Domain model (all rows are scoped by `userId` unless noted):

- **Expense** — one statement line. Columns keep the Spanish bank-statement names (`fecha`, `comercio`, `valor`, `saldo`, `tarjeta`…). `kind` is `'expense' | 'payment'`: payments (card payments/credits) are excluded from expense views and dashboard totals and surface on the Payments page instead. `excluded` hides an expense from dashboard totals. `currency` is detected at import (GTQ/USD/EUR). `exchangeRate` snapshots the rate from `currency` to the user's base currency (`user.currency`) at `fecha`; the converted value is always derived (`valor * exchangeRate`), never stored — `1` for base-currency rows, `NULL` while conversion is pending. Money columns are `numeric` with `decimalTransformer` (`common/decimal.transformer.ts`) so they read as JS numbers.
- **ExchangeRate** (`rates/`) — **shared across all users**: daily rate cache (1 `base` = `rate` `quote` on `date`). Only USD legs are cached; cross rates derive as `perUsd(to)/perUsd(from)`. `RatesService` fetches USD↔GTQ from Banco de Guatemala's SOAP service and other pairs from frankfurter.dev (ECB), falling back to the most recent published rate up to 7 days back. `RateStampingService` backfills/restamps expense rates — via `POST /expenses/refresh-rates` (dashboard banner button) and automatically when the user changes base currency. Rate fetching is best-effort: provider failures leave `exchangeRate` NULL and never block imports/saves.
- **Concept** — one per distinct merchant (`comercio`) per user; holds the merchant → category assignment. Created on the fly when expenses are inserted (payments get no concept).
- **Category** — per-user catalog with colors; a default set (`common/default-categories.ts`) is seeded on registration.
- **MerchantCategoryStat** — **shared across all users** (not user-scoped): records votes for manual concept→category assignments per normalized merchant name. Auto-categorization checks these learned stats first, then falls back to keyword rules in `common/category-suggester.ts`. Re-assigning a concept revokes the vote for the previous category.
- **ImportBatch** — one per uploaded statement, with parsed metadata (cardholder, card number, limits, statement/payment dates). Each account's latest batch with a `paymentDueDate` drives the payment due-date reminders (`GET /import/payment-reminders`, dashboard card): decision logic in `import/payment-reminders.util.ts`, auto-settled when a `kind='payment'` row posts after the statement cut. Accounts may also set a manual monthly `paymentDueDay` as a fallback source when no recent statement carries a due date.
- **RecurringExpense** — template that generates Expense rows (`recurringExpenseId` links back); recurrence logic in `recurring/recurrence.util.ts`.

`import/excel-parser.ts` does the heavy lifting for uploads: auto-detects the transaction header row (FECHA/COMERCIO/VALOR…), parses amounts like `Q. 27,561.01`, detects currency from the symbol, and classifies each line as expense vs payment (movement type CREDITO, payment-like description, or running balance drop).

`expenses/expenses.service.ts` builds all dashboard aggregates (`/expenses/summary`): by category/card/month/day, previous-period comparison (only for ranges ≤ 31 days), top merchants.

### Frontend (Angular 21 + PrimeNG 21 + Transloco)

Standalone components, **zoneless** change detection, signals — no NgModules. Components are single-file with inline templates, and feature files drop the `.component` suffix (e.g. `features/dashboard/dashboard.ts` exports `DashboardComponent`). All routes in `app.routes.ts` are lazy `loadComponent`; authenticated routes nest under `MainLayoutComponent` behind `authGuard`.

- `core/` — `auth/` (JWT stored client-side, `authInterceptor` attaches it, guards), `services/` (one HTTP service per backend domain), `models.ts` (shared API types), `i18n/`, `currency.pipe.ts`.
- `features/` — one folder per page; `features/shared/` holds reusables (`filter-bar`, `expense-form-dialog`, `category-select`).
- `filter-bar` is the shared filtering UI (period presets, date range, card, category, concept, search) used by dashboard/expenses/payments; filter state persists per page and dashboard charts navigate to the pre-filtered Expenses page.

**i18n:** every user-facing string goes through Transloco. Add new keys to **both** `frontend/public/i18n/en.json` and `es.json` (English is the default; language is a per-user setting).

## Domain gotchas

- Expense `fecha` is the bank **posting** date, not the purchase date — banks defer weekend transactions to Monday, so avoid day-of-week analyses.
- When aggregating money, convert to the user's base currency with `valor * COALESCE(exchange_rate, CASE WHEN currency = :base THEN 1 END)` (see `CONVERTED` in `expenses.service.ts`): unstamped foreign rows drop out of SUMs and surface via the summary's `unconvertedCount`. The `byCurrency`/`totalsByCurrency` breakdowns stay in original (unconverted) amounts.
- Remember to exclude `kind = 'payment'` and `excluded = true` rows from any new spend calculation.
