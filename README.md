# TradeTrack Pro

Trading client management: Next.js (App Router) frontend + Express/MongoDB API in `server/`.
It records and analyzes trading activity. It never executes trades.

## Run locally
1. API: `cd server && cp .env.example .env`, fill `MONGODB_URI` (Atlas) and `JWT_SECRET`
   (`openssl rand -hex 48`), then `npm run dev`.
2. Optional sample data: set `SEED_ADMIN_EMAIL` and `SEED_PASSWORD` in `server/.env`, run `npm run seed`
   (add `-- --reset` to wipe first). All seeded names and trades are labelled sample data.
3. Frontend: `cp .env.example .env.local`, then `npm run dev` (http://localhost:3000).

## Accounts and roles
- The first registered account becomes the Admin (restrict it with `ADMIN_EMAIL`). Later registrations are Clients.
- Admins create clients (with a portal login) and own all trade writes. Clients can only read their own data;
  this is enforced on the server for trades, analytics, reports, chat and notifications.

## Environment
Frontend: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`.
Server: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (comma separated allowed origins), optional `ADMIN_EMAIL`,
`CLOUDINARY_*` (chat attachments are disabled until set). Secrets live only in `server/.env`.

## Deploy
- Vercel: import the repo root, set the two `NEXT_PUBLIC_*` variables.
- Render or Railway: root directory `server`, start command `npm start`, set the server variables,
  and set `CLIENT_URL` to your Vercel URL. Socket.IO needs a long-running service (not serverless).
- Atlas: allow the API host's IP in Network Access.

## Importing and syncing trades
- **CSV import** (admin): Import trades page. Upload a CSV from MetaTrader, a broker or an exchange, match the
  columns, run "Check file", then import. Rows with the same trade ID are skipped, so re-importing is safe.
- **Exchange sync** (spot crypto: Binance, Bybit, OKX, Kraken, KuCoin): client profile > Connected accounts
  (admin) or Settings (client). Use read-only API keys only. Keys are encrypted with AES-256-GCM using
  `ENCRYPTION_KEY` (64 hex chars: `openssl rand -hex 32`) and are never sent back to the browser.
  Set `ENCRYPTION_KEY` on Render too, and keep a backup of it.
- Spot fills are matched first-in-first-out into round-trip trades. Fees paid in other coins (for example BNB)
  are not counted. Futures and margin are not supported yet. Sell orders with no buy inside the history window
  are skipped and reported.
- A background job syncs every `SYNC_INTERVAL_MIN` minutes (default 5). Render's free plan sleeps when idle,
  which pauses syncing; use an always-on plan for reliable sync.
- Synced trades are read-only except strategy and notes.
- Forex via MetaTrader (MetaApi) is not included yet.

## Notes
- The JWT is kept in `localStorage` (cross-site cookies are impractical for a Vercel + Render split).
  Keep the CSP strict and avoid injecting untrusted HTML.
- P/L is stored net of fees; when left blank on a closed trade it is computed from prices.
- Amounts are shown in USD.
