# Email tracker

See when the emails you send from Gmail are opened and which links get clicked. A Chrome extension, a small Go server, and a one-page dashboard. Built for one person (or a few accounts of theirs) on free tiers: everyone runs their own copy.

- **Opens**: a 1×1 image at the end of each email. **Clicks**: links are routed through the server, then redirect to the original.
- **Inside Gmail**: open a sent email and a line above it says "Opened 3× · last 2 hours ago · 1 click".
- **Dashboard**: every email, who it went to, and a timeline of opens and clicks.
- Your own views aren't counted on any device: every minute the extension swaps your copies of your tracked emails (your Sent copy, and the quote inside each reply to it) for ones whose tracking links end in `?me`, which the server ignores. A reply opened on your phone within that first minute can still count once. Neither is the scan Gmail runs on new mail, nor repeat views within a minute.

## What it can't do

- **Which recipient opened it.** With several recipients there's one image, loaded through Google's image proxy, so it only says *someone* opened it.
- Opens are counted only if the recipient's mail app loads images. Apple Mail's privacy protection loads them for everyone, so those opens mean little.

## Setup

You need: a [Fly.io](https://fly.io) account, a Postgres database ([Supabase](https://supabase.com) free tier works), a [Vercel](https://vercel.com) account, and a Google Cloud project.

1. **Dashboard URL.** Deploy `dashboard/` once to get its URL: `cd dashboard && vercel deploy --prod`.
2. **Google sign-in.** In Google Cloud → *Google Auth Platform*: set up branding (External), add your Gmail address(es) as test users under *Audience*, then *Clients → Create client → Web application* with your dashboard URL as an authorised JavaScript origin. Copy the client ID.
3. **Server.**
   ```sh
   cd server
   fly launch --no-deploy          # pick an app name; this writes it into fly.toml
   fly secrets set DATABASE_URL='postgres://...' \
     HMAC_KEY="$(openssl rand -base64 32)" \
     GOOGLE_CLIENT_ID='....apps.googleusercontent.com' \
     OWNER_EMAIL='you@gmail.com,your-other@gmail.com' \
     DASHBOARD_ORIGIN='https://your-dashboard.vercel.app'
   fly deploy
   ```
   The server creates its tables on first boot. `OWNER_EMAIL` lists the Google accounts allowed to sign in.
4. **Fill in your URLs.** Replace the placeholders:
   - `YOUR-SERVER.example` in `extension/api.js`, `extension/gmail.js`, `extension/manifest.json` and `dashboard/app.js`, with your Fly app's host (`your-app.fly.dev`).
   - `YOUR-DASHBOARD.example` in `extension/api.js`, `extension/setup.js` and `extension/manifest.json`, with your dashboard's host.
   - `YOUR-GOOGLE-CLIENT-ID` in `dashboard/index.html` and `extension/google-auth.js`.
   Then deploy the dashboard again.
5. **Gmail permission.** Enable the Gmail API in your Google Cloud project. Load the extension once (next step) to see its id on `chrome://extensions`, then add `https://<extension-id>.chromiumapp.org/` as an authorised redirect URI on the same client.
6. **Extension.** `chrome://extensions` → Developer mode → *Load unpacked* → pick `extension/`. A setup page opens: sign in on the dashboard with each Gmail account you send from, then click *Connect Gmail* for each (Google warns the app isn't verified; it's yours, continue). Turn off other trackers (Mailtrack, etc.): they rewrite the same links. Reopen setup any time from the Email Tracker toolbar button; it shows a red "!" until setup is done.

Send an email from Gmail. It shows up on the dashboard, and once the recipient opens it, inside Gmail too.

## How it fits together

```
Gmail + extension ──POST /mails──▶ server ──▶ Postgres
recipient's mail app ──GET /o/… (image), /c/… (link)──▶ server
dashboard / extension ──GET /stats (signed in)──▶ server
```

- Tracking URLs carry an HMAC signature, so nobody can fake opens or clicks for an email or turn the server into an open redirect.
- Signing in: the dashboard gets a Google ID token, and the server checks it with Google and against `OWNER_EMAIL`. The server then hands out its own signed 30-day session, which the dashboard and extension use from then on. The HMAC key never leaves the server.

## Tests

- `cd server && go test ./...`: the signature checks.
- `node extension/mime.test.mjs`: marking your own copy of an email.
- `server/test.sh`: every server endpoint, against a running server; deletes its test email afterwards.
  - Local, with Postgres in Docker:
    ```sh
    docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:17
    cd server
    DATABASE_URL='postgres://postgres:dev@localhost:5432/postgres?sslmode=disable' HMAC_KEY=dev-key \
      GOOGLE_CLIENT_ID=x OWNER_EMAIL=a@test.dev,b@test.dev DASHBOARD_ORIGIN=http://localhost:5199 go run . &
    ./test.sh
    ```
  - Live: `BASE=https://YOUR-FLY-APP.fly.dev HMAC_KEY=... DATABASE_URL=... A=you@gmail.com B=your-other@gmail.com ./test.sh`, where A and B are two accounts in `OWNER_EMAIL`.
