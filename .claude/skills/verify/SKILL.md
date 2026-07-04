---
name: verify
description: How to drive and visually verify this app end-to-end (frontend + backend + auth) for UI changes.
---

# Verifying UI changes in this app

## Handles

- Frontend dev server: `cd frontend; npm start` → http://localhost:4200 (ng serve hot-reloads edits).
- Backend: `cd backend; npm run start:dev` → http://localhost:3000/api. Works against hosted Postgres even if local Docker (port 5433) is down — check ports before starting anything: 4200/3000 are often already running.
- No Playwright in the repo. Install `playwright-core` in the session scratchpad and launch system Chrome:
  `executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'`, `headless: true`.

## Auth (all app routes are behind login)

1. Register a throwaway user via API — password must satisfy complexity rules (e.g. `Verify123!x`):
   `POST http://localhost:3000/api/auth/register` with `{ name, email, password, language: 'en' }` → `accessToken`.
2. In Playwright, before navigation: `context.addInitScript(t => localStorage.setItem('ats_token', t), token)`.
   Optional: `ats_theme` (`light`/`dark`) and `ats_lang` (`en`/`es`) — note the account's saved settings win over these after the profile loads.

## Driving

- Mobile viewport 390×844, probe 320×700; desktop 1400×900.
- Header nav collapses to a hamburger below the `lg` breakpoint (992px); button has aria-label "Menu", drawer links are `p-drawer a[href="/expenses"]` etc. (role/name lookup for "Expenses" is ambiguous with "Fixed Expenses" — use href).
- Horizontal-overflow probe: compare `document.documentElement.scrollWidth` vs `clientWidth`; to find culprits, walk leaf elements and report those with `getBoundingClientRect().right > clientWidth`. The expenses table is wide by design — it scrolls inside its own container, so check the document, not the table cells.

## Gotchas

- Registered throwaway users persist in the DB; use a random email like `verify-<random>@example.com`.
- `p-select` host is inline-flex — showing it responsively needs `md:inline-flex`, not `md:block` (block breaks its layout).
