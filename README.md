# Email tracker

See when the emails you send from Gmail are opened and which links get clicked. A Chrome extension, a small Go server, and a one-page dashboard. Built for one person (or a few accounts of theirs) on free tiers: everyone runs their own copy.

- **Opens**: a 1×1 image at the end of each email. **Clicks**: links are routed through the server, then redirect to the original.
- **Inside Gmail**: open a sent email and a line above it says "Opened 3× · last 2 hours ago · 1 click".
- **Dashboard**: every email, who it went to, and a timeline of opens and clicks.
- Your own views in the same browser (compose window, Sent, the thread) aren't counted, and neither is the scan Gmail runs on new mail.

## What it can't do

- **Which recipient opened it.** With several recipients there's one image, loaded through Google's image proxy, so it only says *someone* opened it.
- **Your own views on other devices.** Opening your sent email on your phone looks the same to the server as the recipient opening it.
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
   - `YOUR-DASHBOARD.example` in `extension/api.js`, `extension/options.js` and `extension/manifest.json`, with your dashboard's host.
   - `YOUR-GOOGLE-CLIENT-ID` in `dashboard/index.html`.
   Then deploy the dashboard again.
5. **Extension.** `chrome://extensions` → Developer mode → *Load unpacked* → pick `extension/`.
6. **Sign in.** Open your dashboard and sign in with Google, once for each Gmail account you send from. The extension picks up each sign-in; each lasts 30 days from last use. Each account only ever sees its own emails. Turn off other trackers (Mailtrack, etc.): they rewrite the same links.

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

- `server/test.sh`: runs the server's endpoints against a local or live server and deletes its test data afterwards (instructions at the top of the file).
- `cd server && go test ./...`: the signature checks.
