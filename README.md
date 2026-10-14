# Email tracker

A Gmail open and click tracker with no signature, no badge and no footer. You run your own copy, so the data stays in your accounts. Supabase, Vercel and Google Cloud have free tiers. Fly.io has no free tier for new accounts and needs a card on file.

I built it because Mailtrack charges to remove the "Sent with Mailtrack" line from every email you send.

## What you get

- Opens, from a 1×1 image at the end of each email.
- Link clicks. Each link goes through your server and then on to the original page.
- ✓✓ next to opened emails in your Gmail lists, and a line like "Opened 3× · last 2 hours ago · 1 click" above a sent email when you open it.
- A dashboard with every email, who it went to, and when it was opened and clicked.
- Several Gmail accounts at once.

Your own reads of recent emails don't count, even on your phone. Every minute the extension swaps your copies of tracked emails (the Sent copy, and the quoted copy inside each reply) for ones whose tracking links end in `?me`, and the server ignores those. Gmail's automatic scan of new mail doesn't count either, and neither do repeat views within a minute.

## What it can't do

- Tell you which recipient opened an email. Several recipients share one image, and Google's image proxy hides who loaded it.
- See opens in mail apps that block images. Apple Mail goes the other way and loads every image in advance, so opens from Apple Mail readers mean little.
- Track emails sent with Schedule send. They go out untracked.
- Ignore your own read of a reply on your phone in the minute before the swap runs. That one counts once.
- Ignore your own reads of older emails. The swap only looks at the 20 newest messages from the last two days, and only while Chrome is running.
- Tell a person's click from a link scanner's. Scanners like Outlook's Safe Links count as clicks.
- Run outside Chrome and other Chromium browsers.

## Setup

Paste this into Claude Code, Codex or Cursor. The agent downloads the code and walks you through every step below. It takes about 45 minutes, half of it in the Google Cloud console.

```
Set up this email tracker: https://emailtracker.shrey258.com/skill.md
```

You need accounts on [Fly.io](https://fly.io), [Supabase](https://supabase.com) (or any Postgres), [Vercel](https://vercel.com) and Google Cloud.

To do it by hand:

1. **Dashboard URL.** Deploy `dashboard/` once to get its address: `cd dashboard && vercel deploy --prod`.
2. **Google sign-in.** In Google Cloud, open *Google Auth Platform*. Set up branding as *External*, add your Gmail addresses as test users under *Audience*, then go to *Clients → Create client → Web application* and add your dashboard URL as an authorized JavaScript origin. Copy the client ID.
3. **Server.** Put your app name and nearest region in `server/fly.toml`, then:
   ```sh
   cd server
   fly apps create your-app-name
   fly secrets set DATABASE_URL='postgres://...' \
     HMAC_KEY="$(openssl rand -base64 32)" \
     GOOGLE_CLIENT_ID='....apps.googleusercontent.com' \
     OWNER_EMAIL='you@gmail.com,your-other@gmail.com' \
     DASHBOARD_ORIGIN='https://your-dashboard.vercel.app'
   fly deploy
   ```
   The server creates its tables on first boot. `OWNER_EMAIL` lists the Google accounts allowed to sign in.
4. **Your URLs.** Replace the placeholders, then deploy the dashboard again.
   - `YOUR-SERVER.example` with your Fly host (`your-app.fly.dev`) in `extension/api.js`, `extension/gmail.js`, `extension/manifest.json` and `dashboard/app.js`.
   - `YOUR-DASHBOARD.example` with your dashboard host in `extension/api.js`, `extension/setup.js` and `extension/manifest.json`.
   - `YOUR-GOOGLE-CLIENT-ID` in `dashboard/index.html` and `extension/google-auth.js`.
5. **Gmail permission.** Enable the Gmail API in your Google Cloud project. Load the extension once (next step) to see its ID on `chrome://extensions`, then add `https://<extension-id>.chromiumapp.org/` as an authorized redirect URI on the same client.
6. **Extension.** Go to `chrome://extensions`, turn on Developer mode, click *Load unpacked* and pick `extension/`. A setup page opens. For each Gmail account you send from, sign in on the dashboard, then click *Connect Gmail*. Google warns that the app isn't verified. It's your own app, so continue. Turn off other trackers like Mailtrack, because they rewrite the same links. The toolbar button reopens setup and shows a red "!" until it's done.

Send an email to another address you own and open it on your phone or in another browser. The extension blocks the tracking image in every Gmail tab of the browser it runs in, so opening it there never counts. The email shows up on the dashboard right away, and the open within a minute.

## How it works

```
Gmail + extension ──POST /mails──▶ server ──▶ Postgres
recipient's mail app ──GET /o/… (image), /c/… (link)──▶ server
dashboard / extension ──GET /stats (signed in)──▶ server
```

Every tracking URL carries an HMAC signature made with a key only the server has. Nobody can fake an open or a click, or use your server to redirect people to their own links.

The dashboard signs you in with Google. The server checks the ID token with Google and against `OWNER_EMAIL`, then issues its own 30-day session, which the dashboard and extension use from then on.

## Tests

`server/test.sh` calls every server endpoint against a running server and deletes its test email afterwards. Locally, with Postgres in Docker:

```sh
docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:17
cd server
DATABASE_URL='postgres://postgres:dev@localhost:5432/postgres?sslmode=disable' HMAC_KEY=dev-key \
  GOOGLE_CLIENT_ID=x OWNER_EMAIL=a@test.dev,b@test.dev DASHBOARD_ORIGIN=http://localhost:5199 go run . &
./test.sh
```

Against your live server: `BASE=https://YOUR-FLY-APP.fly.dev HMAC_KEY=... DATABASE_URL=... A=you@gmail.com B=your-other@gmail.com ./test.sh`, where A and B are two accounts in `OWNER_EMAIL`.
