# Tribu

**Tribu** is an installable PWA for managing **shared subscriptions** (Spotify, Netflix, Disney+, ChatGPT Team…). Create groups you administer, join groups you belong to, approve payment proofs, split costs in Bs/USD, and pay from a shared fund — all from a mobile-first, full-bleed web app.

Built with **Next.js 16** (App Router), **React 19**, **TypeScript**, and **Supabase** (Postgres + Auth + Row Level Security).

> Note: this repo uses a modified build of Next.js. In Next.js 16, Middleware is called **Proxy** (`proxy.ts`), and metadata `themeColor` lives in the `viewport` export — the code already follows these conventions.

---

## Prerequisites

- **Node.js 20+**
- A **Supabase project** (free tier is fine) — you need its URL and **publishable** API key

---

## 1. Install

```bash
npm install
```

## 2. Configure environment

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```

Find these in **Supabase → Project Settings → API**. Only the **publishable** key is used (safe for the browser); never put the `service_role`/secret key in a `NEXT_PUBLIC_` variable. `.env.local` is gitignored.

## 3. Set up the database

In **Supabase → SQL Editor**, run these two files **in order**:

1. `supabase/migrations/0001_init.sql` — tables, Row Level Security policies, the new-user trigger, the services catalog, grants (and a backfill for any pre-existing users).
2. `supabase/migrations/0002_sample_data.sql` — the optional `load_sample_data()` demo seeder.

Both scripts are **idempotent** (safe to re-run). `0001` ends with `notify pgrst, 'reload schema'` so the new tables are exposed to the API immediately.

> If you hit **“Could not find the table 'public.profiles' in the schema cache”**, the migration hasn't been applied yet — run the two files above, then reload. (If it lingers, force **Dashboard → Settings → API → Reload schema cache**.)

## 4. (Recommended) Smooth demo auth

For a friction-free demo, disable email confirmation: **Supabase → Authentication → Providers → Email → uncheck “Confirm email.”** Otherwise sign-up requires clicking a confirmation link before you can log in (the app handles and messages both cases).

## 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**First run:** sign up → you'll land on an **empty** account →

- tap **“Cargar datos de ejemplo”** on Home to seed sample groups, wallet, participants and payment history, or
- tap **“Crear un grupo”** to start from scratch.

Sign out from the **Perfil** tab.

---

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the unit tests (`tests/`, Node's built-in runner) |

For local PWA push/HTTPS testing: `npx next dev --experimental-https`.

---

## How it works

- **Auth gate** (`components/AppRoot.tsx`) watches the Supabase session. Signed out → login/signup screen; signed in → it fetches the user's data and mounts the app.
- **State** flows one way: components read via `useApp()` + selectors and mutate only through `actions`, which persist to Supabase (optimistically) and update the local reducer.
- **RLS** keeps every row scoped to its owner (`owner_id / user_id = auth.uid()`). Group rosters (“participants”) are display-only records, not auth users, which keeps policies owner-scoped and free of `groups ↔ members` recursion.

### Project structure

```
app/                 App Router entry, manifest, viewport, global styles
proxy.ts             Next.js 16 "Proxy" (middleware) — refreshes the Supabase session
utils/supabase/      Supabase clients (browser / server / proxy helper)
lib/
  db/                Row types + RLS-bound data-access API (fetch + mutations)
  store.tsx          Context + reducer; hydrates from Supabase, persists mutations
  selectors.ts       Pure derived data for the screens
  paylogic.ts        Pure payment helpers (combined debts, advance coverage, CSV export)
  theme.ts           Design tokens (colors, status styles)
components/
  auth/              Login / signup screen
  phone/             App shell + chrome (status-less full-bleed shell, nav, toast)
  screens/           One component per screen + router
  ui/                Reusable primitives (Avatar, Card, Button, Icons, …)
  pwa/               Service-worker registration + iOS install prompt
supabase/migrations/ SQL schema, RLS, seed
public/              Service worker, manifest icons
tests/               Unit tests for the pure payment logic (node --test)
```

### Payments

- **Monthly charges** land in the `participant_charges` ledger with the cuota frozen at that month's official rate; prepaid balances settle automatically and suppress reminders while they cover the cuota.
- **Combined payment** (Home → “Pagar todo junto”): every debt collected by the same administrator — across all their groups — is paid in one transaction (`submit_payment_v2` RPC) with a single shared receipt; each group keeps its own ledger rows.
- **Paying for someone else**: the Pay screen lets you choose “mi cuota” or a fellow member with owed months. History records both who the payment belongs to and who made it (`paid_by`), and the beneficiary is notified on submission and review.
- **Admins pay without receipts**: a group's admin registers payments (their own or a member's) instantly — no upload, no review.
- **Per-member prices**: the admin can override any member's monthly cuota (tap the price chip on the roster). The override is stored in the group's currency (`group_participants.custom_amount`), so USD conversion and rounding rules still apply; already-billed months keep their frozen price and collection targets sum each member's actual cuota.
- **Admin without a slot**: groups can be created (or toggled later) so the admin only manages the plan; they keep notifications, approvals and management access without a roster row.
- **Export & archive**: the group history exports to an Excel-compatible CSV; afterwards the exported *paid* rows can be archived (soft delete via `archive_paid_charges`, confirmation required). Unpaid rows are never deleted.

## PWA

Installable via the web app manifest (`app/manifest.ts`) with generated icons in `public/icons/`, a service worker (`public/sw.js`), and standalone display + safe-area handling. Served over HTTPS, modern browsers offer “Add to Home Screen.”

## Deploy

Deploy on any Next.js host (e.g. [Vercel](https://vercel.com/new)). Set the two `NEXT_PUBLIC_SUPABASE_*` environment variables in the host, and make sure the SQL migrations have been applied to the target Supabase project.
