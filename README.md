# Cash Book — Credit Card Transaction Tracking System

A mobile-first web app for a shop owner who gives customers cash against their
credit card, and needs to track commission, settlement and reports.

**Record → Calculate → Track → Settle → Report**

---

## Stack

| Layer    | Tech                                        |
| -------- | ------------------------------------------- |
| Frontend | Next.js 15 (App Router, JS) + Tailwind CSS 4 |
| Backend  | Node.js + Express 4                          |
| Database | MongoDB (local) + Mongoose 8                 |
| Auth     | JWT in an httpOnly cookie                   |
| Exports  | ExcelJS (`.xlsx`) + PDFKit (`.pdf`)          |

```
cash book/
├── backend/          Express API
│   └── src/
│       ├── config/db.js
│       ├── models/           User, Transaction, Counter
│       ├── controllers/      auth, transaction, report, export
│       ├── middleware/       auth, error
│       ├── utils/            calc, dates, token
│       ├── routes/index.js
│       ├── seed.js
│       └── server.js
└── frontend/         Next.js app
    └── src/
        ├── app/              routes (dashboard, transactions, reports…)
        ├── components/       AppShell, TransactionForm, ui primitives
        └── lib/              api client, formatters
```

---

## Running it

You need **MongoDB running locally** on `mongodb://127.0.0.1:27017`.

```bash
# 1. install (once)
npm run install:all

# 2. create the two shop-owner logins (once)
npm run seed

# 3. start both servers — in two terminals
npm run dev:api     # http://localhost:5000/api
npm run dev:web     # http://localhost:3000
```

Open **http://localhost:3000** on your phone or in a mobile-sized browser window.

> On a real phone: both servers already listen on your LAN, so visit
> `http://<your-pc-ip>:3000` and set `NEXT_PUBLIC_API_URL=http://<your-pc-ip>:5000/api`
> in `frontend/.env.local`, plus add that origin to `CLIENT_ORIGIN` in `backend/.env`.

### Production build

```bash
npm run build
npm run start:api
npm run start:web
```

---

## The two logins

Both accounts are logins for the **same shop** — they see and edit the same
transactions. Credentials live in `backend/.env`:

```
OWNER1_EMAIL=owner1@cashbook.local
OWNER1_PASSWORD=Owner@123

OWNER2_EMAIL=owner2@cashbook.local
OWNER2_PASSWORD=Owner@456
```

Change those values and re-run `npm run seed` to update them, or change a
password from inside the app under **Profile → Change password**.

---

## How the commission is calculated

`backend/src/utils/calc.js` is the single source of truth. The New Transaction
screen mirrors it in `frontend/src/lib/format.js` so the figures update live as
you type, before anything is saved.

### Commission **included** — taken out of the cash

Customer asks for ₹1,000 at 30%:

| Figure               | Amount  |
| -------------------- | ------- |
| Commission           | ₹300    |
| **Customer receives**| **₹700** |
| **Card swiped for**  | **₹1,000** |
| Shop owner share (50%) | ₹150  |
| Card company share (50%) | ₹150 |
| **Card company pays you back** | **₹850** (700 + 150) |

### Commission **excluded** — added on top of the swipe

Customer asks for ₹1,000 at 30%:

| Figure               | Amount    |
| -------------------- | --------- |
| Commission           | ₹300      |
| **Customer receives**| **₹1,000** |
| **Card swiped for**  | **₹1,300** |
| Shop owner share (50%) | ₹150    |
| Card company share (50%) | ₹150  |

The **split is set per transaction**. It defaults to 50/50 (or whatever you set
as your default in Profile), and you can change it on any individual
transaction — enter your share %, and the card company gets the rest.

**Settlement** is what the card company actually pays back into your account:
the cash the customer received **plus your share** of the commission — the
company keeps its own share. So for the example above the company pays you
**₹850**, and your profit on the deal is the ₹150 you kept. That ₹850 is the
figure the dashboard and reports track as pending / received.

Every derived amount is recalculated server-side on save *and* on edit, so the
stored numbers can never drift from the inputs.

---

## Screens

| Screen | What it does |
| ------ | ------------ |
| **Dashboard** | Today's transactions, cash given, commission, income and expenses; all-time settlement received vs pending; loans given vs outstanding; this month's totals; 5 most recent |
| **Customers** | Add/edit customers with a per-customer commission % and type, assigned machine and status; search and filter |
| **Card Machines** | Add/edit the machines you swipe on (name, card company, device id, status) |
| **New Transaction** | Pick a machine (shown as tappable cards, first one pre-selected); optionally pick a saved customer (fills name/mobile/commission) or leave it as a walk-in; amount, type, split %, card ref, notes — with a live panel showing what the card company will pay you |
| **Income / Expenses** | Record other money in and out, by category (managed list) and receiver/payee; per-list totals |
| **Loans** | Money lent out, with repayments tracked against each loan and a running outstanding balance |
| **Categories** | Manage the income and expense category lists |
| **More** | Hub linking Customers, Machines, Income, Expenses, Loans, Settlements, Categories and Profile |
| **Transactions** | Search by mobile / txn no / card ref / amount, filter by status and date range, running totals for the filtered set, paginated |
| **Transaction detail** | Full breakdown, one-tap settle, edit, delete |
| **Pending Settlements** | Everything awaiting the card company, oldest first; multi-select to settle several at once |
| **Daily Report** | Any date's totals plus that day's transactions |
| **Monthly Report** | Month totals with a day-wise bar breakdown; tap a day to open its daily report |
| **Commission Report** | Your share vs the card company's, split bar, grouped by rate and by type |
| **Profile** | Name, shop name, default commission % and split %, change password, sign out |

All reports export to **Excel** and **PDF**.

---

## API

All routes are under `/api`. Everything except `/auth/login` requires the
auth cookie.

| Method | Route | Purpose |
| ------ | ----- | ------- |
| POST | `/auth/login` | Sign in |
| POST | `/auth/logout` | Sign out |
| GET | `/auth/me` | Current user |
| PATCH | `/auth/profile` | Update name, shop, defaults |
| POST | `/auth/change-password` | Change password |
| GET | `/customers` | List — `q`, `status`, `machine` |
| POST · GET · PATCH · DELETE | `/customers` · `/customers/:id` | Manage customers |
| GET | `/machines` | List card machines — `q`, `status` |
| POST · GET · PATCH · DELETE | `/machines` · `/machines/:id` | Manage machines |
| GET · POST · PATCH · DELETE | `/categories` · `/categories/:id` | Income/expense categories (`?kind=`) |
| GET · POST · GET · PATCH · DELETE | `/income` · `/income/:id` | Income entries — `q`, `category`, `from`, `to` |
| GET · POST · GET · PATCH · DELETE | `/expenses` · `/expenses/:id` | Expense entries — `q`, `category`, `from`, `to` |
| GET · POST · GET · PATCH · DELETE | `/loans` · `/loans/:id` | Loans — `q`, `status`, `from`, `to` |
| POST · DELETE | `/loans/:id/settlements[/:settlementId]` | Record / remove a loan repayment |
| GET | `/transactions` | List — `q`, `status`, `customer`, `machine`, `from`, `to`, `minAmount`, `maxAmount`, `page`, `limit` |
| POST | `/transactions` | Create (requires `machine` + `customer`; snapshots the customer) |
| GET | `/transactions/:id` | One transaction |
| PATCH | `/transactions/:id` | Update (recalculates amounts) |
| DELETE | `/transactions/:id` | Delete |
| PATCH | `/transactions/:id/settlement` | Set `pending` / `received` |
| POST | `/transactions/bulk-settle` | Settle many at once |
| GET | `/reports/dashboard` | Dashboard summary |
| GET | `/reports/daily?date=YYYY-MM-DD` | Daily report |
| GET | `/reports/weekly?date=YYYY-MM-DD` | Weekly report (Mon–Sun containing the date) |
| GET | `/reports/monthly?month=YYYY-MM` | Monthly report + day-wise |
| GET | `/reports/commission?month=YYYY-MM` | Commission report (by rate, type, customer, machine) |
| GET | `/reports/customers?month=YYYY-MM` | Totals per customer |
| GET | `/reports/machines?month=YYYY-MM` | Totals per machine |
| GET | `/reports/settlement` | Pending settlements |
| GET | `/export/excel?type=…` | `.xlsx` — `daily`, `weekly`, `monthly`, `commission`, `settlement`, `transactions`, `income`, `expenses`, `loans`, `customers`, `machines`, `customer-report`, `machine-report` |
| GET | `/export/pdf?type=…` | `.pdf` — same types |

---

## Notes on the data model

- **Transaction numbers** (`TXN-000001`) come from an atomic counter
  collection, so they stay unique under concurrent writes.
- **Settlement amount** is what the card company pays back into your account:
  the cash the customer received plus your share of the commission — the
  company keeps its own share. "Pending" totals sum that figure across
  unsettled transactions.
- **Report day boundaries** use the shop's own timezone (`REPORT_TZ` in
  `backend/.env`, default `Asia/Kolkata`), not UTC, so "today" means your today.
- **Money** is rounded to 2 decimals at every step, and the two commission
  shares are derived by subtraction so they always sum to the total exactly.

---

## Configuration

`backend/.env`

| Key | Default | Meaning |
| --- | ------- | ------- |
| `PORT` | `5000` | API port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/cashbook` | Database |
| `JWT_SECRET` | *(change this)* | Token signing key |
| `JWT_EXPIRES_IN` | `7d` | Session length |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Allowed CORS origin(s), comma-separated |
| `REPORT_TZ` | `Asia/Kolkata` | Timezone for report day/month boundaries |

`frontend/.env.local`

| Key | Default | Meaning |
| --- | ------- | ------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api` | Where the app calls the API |

> Before deploying anywhere public: set a long random `JWT_SECRET`, set
> `NODE_ENV=production` (which turns on the `secure` cookie flag), and serve
> over HTTPS.
