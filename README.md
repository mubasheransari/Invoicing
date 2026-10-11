# FBR Digital Invoicing (web)

Website version of the mobile app: search invoices by **GNO**, **STN** or **From date**
(any one is enough, or combine them), review them, and **Submit to FBR** - one invoice
or many at once. An invoice that FBR has accepted can never be submitted again.

Built with Next.js 16 (App Router, Cache Components), React 19 and Tailwind CSS 4.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Settings live in `.env.local` (copy `.env.example`; the file is git-ignored). Restart the
server after changing it.

## How it works

The browser never talks to Oracle or FBR directly. It only calls two routes of this app,
so credentials stay on the server and there are no CORS / http-vs-https problems:

| Route | What it does |
| --- | --- |
| `GET /api/invoices/search?gno=&stn=&fromDate=` | Reads ORDS, repairs its slightly malformed JSON, upper-cases GNO/STN, and adds the "already submitted" status |
| `POST /api/fbr/submit` `{ "gno": "..." }` | Re-reads the invoice from ORDS (the browser can't tamper with amounts), gets a **fresh access token**, posts to `submitinvoice`, and records the result |

Submit rules (all enforced on the server):

* HTTP 200 from FBR is only a success when `validationResponse.statusCode` is `"00"`.
* An accepted invoice is recorded and refused on any later attempt (`409`).
* One submission per invoice at a time (double-click / second tab safe).
* Failed or rejected invoices are **not** recorded, so they can be retried.

## Where things are

```
app/api/...                 route handlers (search, submit)
lib/ords.ts                 ORDS client + parsing
lib/json-repair.ts          fixes ".5", raw newlines, trailing commas in ORDS output
lib/fbr.ts                  token + payload + submit to WebDNA/FBR
lib/submission-store.ts     "already submitted" records (data/submissions.json)
lib/config.ts               reads environment variables
proxy.ts                    optional site login
components/                 UI
```

## Things you must know

* **Seller details** (`SELLER_*`) and the **token credential** (`FBR_TOKEN_*`) are required
  in `.env.local`, or submit stops with a clear message.
* **Login:** set `APP_BASIC_AUTH_USER` and `APP_BASIC_AUTH_PASSWORD` before anyone else can
  reach the site. Without them the site is open.
* **Submission records** are stored in `data/submissions.json` (per `FBR_ENVIRONMENT`), so
  they are shared by everyone using this server. This needs a writable disk (your PC, a VM,
  Docker with a volume). On serverless hosts (e.g. Vercel) the disk is read-only: replace
  the functions in `lib/submission-store.ts` with a database table.
* Change `FBR_ENVIRONMENT` when you switch to production credentials, so staging records
  never block production invoices.
* FBR will reject invoices that lack buyer details and HS codes. Your ORDS data does not
  carry them yet; if you add columns named like the FBR fields (`buyerNTNCNIC`,
  `buyerBusinessName`, `hsCode`, ...) they are picked up automatically.
* `FBR_TEST_ACCESS_TOKEN` skips the token API (testing only; tokens last one hour).
# Invoicing
