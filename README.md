# Penny Pilot

A modern personal finance management web app: Next.js 15 + TypeScript frontend,
Express + Prisma + PostgreSQL backend. Built to replace the Excel-based
personal finance workbook with a real SaaS-style application.

## What's implemented in this pass

- **Dashboard** — 17 live KPI cards (income, expenses, savings, net worth, cash
  flow, budget utilization, savings rate, financial health score, emergency
  fund progress, investment growth, highest category, largest expense,
  averages, transaction count) + Income vs Expense trend chart, Category
  donut chart, and a Financial Health gauge. All computed live from the
  database — nothing hardcoded.
- **Transactions** — full CRUD, search, type filter, pagination, empty state.
- **Budget Planner** — set a monthly budget per category; actual spend,
  remaining, utilization %, variance, and status (Under Budget / Near Limit /
  Over Budget) are all computed live from transactions.
- No demo/seed transactions. The seed script only creates the category /
  subcategory / account taxonomy so dropdowns aren't empty — every screen
  starts with a proper empty state ("No Transactions Yet", "Create Your First
  Budget", "No Data Available" on charts) per the spec.
- All currency is ₹ INR formatted with the Indian numbering system
  (`en-IN` locale, e.g. ₹12,50,000), dates are DD-MM-YYYY.

## Not implemented in this pass (see PROJECT_STATUS.md)

Auth, Income/Expenses/Savings/Investments/Bills/Goals/Analytics/Reports/
Notifications/Settings/Profile pages, CSV/Excel/PDF import-export, and the
exotic chart types (treemap/sunburst/waterfall) are not built yet. The nav
sidebar links to all of them, but only Dashboard, Transactions, and Budget
have real pages right now — the rest will 404 until built in a follow-up
pass. This was scoped deliberately (see your last answer: "full-stack core
… Dashboard + Transactions + Budget … no auth yet").

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (for Postgres, or install Postgres locally)

## Quick start

```bash
# 1. Start Postgres (or point DATABASE_URL at your own instance)
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma generate      # downloads Prisma's query engine — needs network access
npx prisma migrate dev --name init
npm run seed              # creates categories/subcategories/accounts only, no transactions
npm run dev                # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                # http://localhost:3000
```

Open http://localhost:3000 — you'll land on the Dashboard with an honest
empty state until you add your first transaction and budget.

## Important: Prisma generate

This code was written in a sandboxed environment that could not reach
`binaries.prisma.sh`, so `npx prisma generate` / `prisma migrate` could not
be run or verified here. The schema (`backend/prisma/schema.prisma`) and all
controller code were written and hand-reviewed against it, and the rest of
the backend (`tsc --noEmit`) has zero errors once the Prisma client types
exist — but you must run `npx prisma generate` and `npx prisma migrate dev`
yourself as the first step. The frontend was fully installed and both
`tsc --noEmit` and `next build` pass with zero errors in this environment.

## Project structure

```
pfd-pro/
├── backend/           Express + Prisma API (REST, no auth yet)
│   ├── prisma/         schema.prisma, seed.ts
│   └── src/
│       ├── controllers/  business logic (budget status calc, KPI aggregation)
│       ├── routes/
│       ├── schemas/     Zod validation
│       └── middleware/   error handling, validation
├── frontend/          Next.js 15 App Router
│   └── src/
│       ├── app/(app)/    dashboard, transactions, budget pages (sidebar shell)
│       ├── components/   kpi, charts, transactions, budget, ui primitives
│       ├── lib/          api client, ₹ / date formatting
│       └── store/        zustand (theme)
├── docker-compose.yml  postgres + backend + frontend
└── .github/workflows/ci.yml
```

## API summary

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/summary` | All dashboard KPIs |
| GET | `/api/dashboard/trend/income-expense` | Monthly income/expense trend |
| GET | `/api/dashboard/breakdown/category` | Category-wise expense totals |
| GET/POST | `/api/transactions` | List (paginated/filtered) / create |
| GET/PATCH/DELETE | `/api/transactions/:id` | Read / update / delete |
| POST | `/api/transactions/bulk-delete` | Bulk delete by id array |
| GET/POST | `/api/budgets` | List with live actual/status / create |
| PATCH/DELETE | `/api/budgets/:id` | Update / delete |
| GET/POST | `/api/categories`, `/api/accounts` | Reference data for dropdowns |

See PROJECT_STATUS.md for what to build next.
