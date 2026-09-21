# Ledger backend (Google Sheets)

This app stores imported splits in a Google Sheet via a small Apps Script web app.
The Next.js app never talks to Google Sheets directly — it POSTs to this script, which
writes to the spreadsheet it's bound to.

## Deploy

1. Create a new Google Sheet (this will hold your data).
2. In the sheet, open **Extensions > Apps Script**.
3. Delete the default `Code.gs` contents and paste in this repo's `google-apps-script/Code.gs`.
4. Click **Deploy > New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (the URL itself is the only secret; anyone with it can write to your sheet, so don't share it publicly)
5. Copy the deployment URL (ends in `/exec`).
6. Set it as `NEXT_PUBLIC_GAS_URL` in `.env.local` (see `.env.local.example` at the repo root).

The script auto-creates two sheets on first use:

- **Sessions** — one row per "Import to Ledger" click: timestamp, session id, members, a text
  summary, and the raw items/breakdown as JSON (used to restore a session in the app's history panel).
- **Ledger** — one row per person per import: `Timestamp, SessionId, Person, Items, Price` — this is
  the "Name + items → price sum" record.

If you edit `Code.gs` after deploying, use **Deploy > Manage deployments > Edit > New version**
so the change takes effect on the existing URL.
