# Cash Book — Credit Card Transaction Tracking System

A mobile-first web app for a shop owner who gives customers cash against their
credit card, and needs to track charges, settlement, loans and reports.

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

# 2. start both servers — in two terminals
#    (the API creates the two owner logins itself on start)
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
transactions. They are set in code, in `backend/src/owners.js`:

| Email                    | Password |
| ------------------------ | -------- |
| owner1@masaralamana.ae   | 123456   |
| owner2@masaralamana.ae   | 123456   |

Every time the API starts (so on every deploy) it makes sure these are the
only two users: it removes any other user and creates a missing owner.
A password changed in the app under **Profile → Change password** is kept.
To force both passwords back to the ones in `owners.js`, bump
`OWNER_SEED_VERSION` there and deploy, or run `npm run seed` on the server.

---

## How a swipe is calculated

`backend/src/utils/calc.js` is the single source of truth. The New Transaction
screen mirrors it in `frontend/src/lib/format.js` so the figures update live as
you type, before anything is saved.

You type **one amount** and the rate you are charging on it, then say which end
of the deal that amount is:

| `commissionType` | The amount you typed is | AED 1,000 at 3% |
| ---------------- | ----------------------- | --------------- |
| `included` | what the card is swiped for, charge comes out of it | swipe 1,000, cash **970** |
| `excluded` | the cash the customer walks away with, charge goes on top | swipe **1,030**, cash 1,000 |

The other figure is derived, and you can round it by hand — the rate then
follows from what you actually did, read against the amount you typed. So a
3% deal still reads as 3% however the other end was nudged. Whichever you
touched last is the truth, on the screen and on the server.

The supplier fee always comes off the **swipe**, whichever mode was used.

### A worked swipe

Swiped AED 4,311 at 2.57%, on a machine whose supplier rate is 1.90%:

| Figure | How it is worked out | Amount |
| ------ | -------------------- | ------ |
| Charge to customer | swiped − given | **AED 111.00** |
| Cust % | charge ÷ swiped | **2.57%** |
| Supplier fee | swiped × supplier % | **AED 81.91** |
| **Cash you hand over** | swiped − charge | **AED 4,200.00** |
| Margin | charge − supplier fee | **AED 29.09** |
| Supplier A/C | swiped − supplier fee | **AED 4,229.09** |
| Settlement | what actually landed (typed) | **AED 4,229.00** |
| **Profit** | settlement − cash given | **AED 29.00** |

**Margin** is the expected profit; **profit** is the real one. They differ
whenever the bank rounds the deposit down, which is why the settlement figure
is typed rather than assumed. A swipe stays *pending* until you enter it.

The **supplier %** belongs to the card machine, not the entry — set it once on
the machine and every swipe snapshots it, so re-rating a machine later never
rewrites entries already in the book. The **customer %** is per swipe, and
pre-fills from the customer you pick (or from your Profile default).

Every derived amount is recalculated server-side on save *and* on edit, so the
stored numbers can never drift from the inputs. `npm run recalc` in `backend/`
re-derives every row if the formula ever changes.

---

## How the cash flows

A **loan** is cash a customer puts into the shop, so you have a float to hand
out. It is money you owe back. The dashboard shows the total still owed, the
money still sitting with the card company, and the cash you should have left.

The **cash book** (`/cashbook`) is every movement in one ledger with a running
balance:

| Entry | Cash |
| ----- | ---- |
| Loan taken from a customer | **in** |
| Repayment to that customer | out |
| Cash handed over on a swipe | out |
| Settlement from the card company | **in** |
| Income | **in** |
| Expense | out |

A swipe therefore writes two lines: the cash going out on the day of the
swipe, and the company's payment on the day it actually arrived.

---

## Screens

| Screen | What it does |
| ------ | ------------ |
| **Dashboard** | Total loan owed and money still with the card company across the top, plus cash in hand; today's swipes, cash given and margin; income and expenses; this month's totals; 5 most recent |
| **Customers** | Add/edit customers - a name is all that is required - with the rate you charge them, assigned machine and status; search and filter |
| **Card Machines** | Add/edit the machines you swipe on (name, card company, supplier %, device id, status) |
| **New Transaction** | Pick a machine (tappable cards showing each supplier %, first pre-selected); optionally pick a saved customer or leave it a walk-in; one amount plus whether it includes commission or takes it on top, your %, the derived figure to round, card ref, notes — with a live panel showing swipe, charge, supplier fee, margin and supplier A/C |
| **Income / Expenses** | Record other money in and out, by category (managed list) and receiver/payee; per-list totals |
| **Loans** | Cash customers put into the shop, by customer, with repayments and a running outstanding balance; opens on a customer-wise settlement view |
| **Categories** | Manage the income and expense category lists |
| **More** | Hub linking Customers, Machines, Income, Expenses, Loans, Settlements, Categories and Profile |
| **Transactions** | Search by mobile / txn no / card ref / amount, filter by status and date range, running totals for the filtered set, paginated |
| **Transaction detail** | Full breakdown, one-tap settle, edit, delete |
| **Pending Settlements** | Everything awaiting the card company, oldest first; multi-select to settle several at once |
| **Daily Report** | Any date's totals plus that day's transactions |
| **Monthly Report** | Month totals with a day-wise bar breakdown; tap a day to open its daily report |
| **Margin Report** | What you charged vs what the supplier kept, split bar, grouped by your rate and by supplier rate |
| **Profile** | Name, shop name, default charge to customer %, change password, sign out |

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
| GET | `/reports/commission?month=YYYY-MM` | Margin report (by customer rate, supplier rate, customer, machine) |
| GET | `/cashbook?from=&to=` | Every entry in one ledger with a running balance |
| GET | `/reports/customers?month=YYYY-MM` | Totals per customer |
| GET | `/reports/machines?month=YYYY-MM` | Totals per machine |
| GET | `/reports/settlement` | Pending settlements |
| GET | `/export/excel?type=…` | `.xlsx` — `daily`, `weekly`, `monthly`, `commission`, `settlement`, `transactions`, `income`, `expenses`, `loans`, `customers`, `machines`, `customer-report`, `machine-report` |
| GET | `/export/pdf?type=…` | `.pdf` — same types |

---

## Notes on the data model

- **Transaction numbers** (`TXN-000001`) come from an atomic counter
  collection, so they stay unique under concurrent writes.
- **Supplier A/C** is what the card company owes on a swipe (swiped less its
  own fee). "Still with the card company" sums that across unsettled swipes.
- **Settlement amount** is what it actually paid, typed in when the money
  lands, and **profit** is that figure less the cash handed over.
- **Report day boundaries** use the shop's own timezone (`REPORT_TZ` in
  `backend/.env`, default `Asia/Dubai`), not UTC, so "today" means your today.
- **Money** is rounded to 2 decimals at every step, and the charge and fee
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
| `REPORT_TZ` | `Asia/Dubai` | Timezone for report day/month boundaries |

`frontend/.env.local`

| Key | Default | Meaning |
| --- | ------- | ------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api` | Where the app calls the API |

> Before deploying anywhere public: set a long random `JWT_SECRET`, set
> `NODE_ENV=production` (which turns on the `secure` cookie flag), and serve
> over HTTPS.
