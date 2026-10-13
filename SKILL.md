---
name: email-tracker-setup
description: Set up a private Gmail open and click tracker (github.com/shrey258/email-tracker) from nothing: download the code, then deploy it to the user's own Fly.io, Supabase, Vercel, and Google Cloud accounts, until an email they send shows up as opened. Use when the user asks to set up, install, self-host, or deploy the email tracker, Gmail tracking, or read receipts, or to continue or fix an email tracker setup.
---

# Set up the email tracker

**Agent: if you got this file through a fetch tool that summarizes pages, the summary has dropped steps. Run `curl -fsSL https://raw.githubusercontent.com/shrey258/email-tracker/main/SKILL.md` and follow the full text. After Step 0, the same file is at `<dir>/SKILL.md`. Re-read it from there whenever you're unsure of a step.**

The user starts with nothing but this file. They end up with their own copy of the code, server, database, dashboard, Google client, and unpacked Chrome extension. You run every command. The user does every web console step (Supabase, Google Cloud, `chrome://extensions`), because those consoles have no reliable CLI. For each console step, give the exact link and the exact clicks, then wait for the user to say it's done (and for the value, if the step produces one).

Before Step 1, tell the user in 3 lines what they're getting (opens and clicks for emails they send from Gmail, a dashboard, everything on free tiers in their own accounts) and how long it takes: about 45 minutes, half of it in the Google Cloud console.

Then run the check below. For a fresh start, collect these in **one** message, because later steps need them before they come up:
- the folder for the code. Suggest `~/email-tracker`, and say it must be permanent, never `/tmp` or Downloads: Chrome loads the extension straight from that folder, so if it's wiped, tracking stops.
- a Fly app name and their nearest city (you map the city to a code from `fly platform regions`)
- a Vercel project name
- every Gmail address they'll send from. These are needed as Google test users in Step 4, long before `OWNER_EMAIL` in Step 6.

When resuming, ask only for what the clone doesn't already show.

## Before anything: where are they?

```
Is the current directory, or ~/email-tracker, a clone of shrey258/email-tracker?
(check: `git -C <dir> remote get-url origin` contains shrey258/email-tracker,
 or the dir has server/main.go and extension/manifest.json)
├── No → ask once: "Did you already download it somewhere?"
│   ├── Yes → use that folder, check it the same way
│   └── No → Step 0
└── Yes → cd into it, then resume at the first step whose check fails:
    ├── server/fly.toml still says YOUR-FLY-APP        → Step 1
    ├── no dashboard/.vercel/project.json              → Step 2
    ├── extension/manifest.json has no "key" line      → ask if the database exists (Step 3), then Step 3b
    ├── `git grep "YOUR-" -- extension dashboard` hits  → ask if the Google client exists (Step 4), then Step 5
    ├── curl https://<app>.fly.dev/stats isn't 401      → Step 6
    └── 401 → ask if the setup page shows ✓ Ready for every account: yes → Step 8, no → Step 7
```

Never restart a step that's already done: a second Fly app or Google client leaves orphans the user has to clean up, and a second extension key changes the extension ID that the Google client expects.

## Rules for the whole run

- **Never ask the user to paste the database password or HMAC key into chat.** Give them the `fly secrets set` command with placeholders and have them run it in their own terminal. Chat transcripts get logged and shared. The client ID, app name, extension ID, and URLs are not secret; collecting those in chat is fine.
- **Generate `HMAC_KEY` inline with `openssl rand -base64 32` inside the `fly secrets set` command. Never print it.** Nobody needs to see it. Changing it later signs every account out and breaks the tracking links in every email already sent.
- **The dashboard address is always the production alias from Step 2, never a per-deploy URL.** The extension's content-script match and `DASHBOARD_ORIGIN` must equal it exactly, or sign-in silently never reaches the extension.
- **Origins have no trailing slash and no path:** `https://name.vercel.app`, not `https://name.vercel.app/`. CORS compares the string exactly.
- Run each step's check before moving on. A broken Step 3 shows up later as a confusing error in Step 7.

## Step 0: Get the code

Run `git --version` (on macOS a missing git opens the Xcode tools installer; have them finish it). Then:

```sh
git clone https://github.com/shrey258/email-tracker.git <dir>
cd <dir>
```

Run every later command from this folder. If they insisted on a temp folder, use it.

## Step 0b: Tools and accounts

Check `fly version`, `vercel --version`, `openssl version`, and `node --version`.

```
Missing?
├── fly    → macOS: `brew install flyctl`; else `curl -L https://fly.io/install.sh | sh`
├── node   → https://nodejs.org (vercel needs it)
└── vercel → `npm i -g vercel`
```

Then have the user run `fly auth login` and `vercel login`. They also need a Supabase account (or any Postgres), a Google account, and Chrome or another Chromium browser. Never install Go: it's only for running tests, and Fly builds the Dockerfile itself.

## Step 1: Server name

The app name becomes their public tracking host, so letters, digits and dashes only.

1. In `server/fly.toml`, replace `YOUR-FLY-APP` with the name and `sjc` with the region code.
2. Run `fly orgs list`. One org → use it; several → ask which. Then run `fly apps create <name> --org <org>`. If the name is taken, ask for another and redo step 1.

Always pass `--org`: without it, `fly` stops at an interactive picker that an agent's shell can't answer. Never use `fly launch`: it rewrites `fly.toml` and can offer to provision a paid Postgres. The repo's `fly.toml` (scale to zero, 256 MB) is what keeps the server on the free allowance. The server host is `<app>.fly.dev`.

## Step 2: Dashboard URL

Run these four in order. Each is non-interactive, because an agent's shell can't answer Vercel's prompts, and `--yes` alone names the project "dashboard":

```sh
vercel teams ls
vercel project add <name> --scope <team>
vercel link --yes --project <name> --cwd dashboard --scope <team>
vercel deploy --prod --yes --cwd dashboard
```

`vercel teams ls`: one team → use it; several → ask which. Always pass `--scope`: with more than one team, `link` refuses to run without it. If `project add` says the name is taken in their account, they made it earlier: skip to `link`.

The deploy prints JSON with a per-deploy URL. Get the alias with `vercel inspect <that url>`: under *Aliases*, take the shortest one (`https://<name>.vercel.app` if the name was free). The deployed page is broken until Step 5 fills in the placeholders. That's expected.

## Step 3: Database

Supabase → New project (region nearest the Fly region; save the database password) → wait 2–3 minutes for setup → **Connect** (top bar) → the **Direct** tab → keep *Direct connection* → copy the URI and replace `[YOUR-PASSWORD]` in it with the real password. The user keeps this URI to themselves until Step 6; wait only for "done".

- "Exceeded their free project limits": the free plan allows 2 active projects per account. Have them pause one they don't use, or use another Postgres (add `?sslmode=require` unless it's local).
- Direct connection is IPv6-only, and that's fine: Fly machines reach IPv6. Never pick the transaction pooler (port 6543): the server uses pgx, and that pooler breaks prepared statements ("prepared statement already exists").
- A password with `@ : / ? #` in it must be percent-encoded in the URI. The simplest fix is to reset it to letters and digits only.
- The server creates its own tables on first boot. Never run `schema.sql` by hand.

## Step 3b: Extension ID

Give their copy of the extension its own key, so its ID is known now and the redirect URI can go in when the Google client is created (Step 4). Without a key, Chrome derives the ID from the folder path: the user would have to load the extension before finishing the Google client, and moving the folder would break Gmail sign-in.

If `extension/manifest.json` already has a `"key"` line, never generate a new one. Recover the ID instead:

```sh
grep '"key"' extension/manifest.json | cut -d'"' -f4 | openssl base64 -d -A | shasum -a 256 | head -c 32 | tr 0-9a-f a-p
```

Otherwise generate it:

```sh
openssl genrsa 2048 2>/dev/null | openssl rsa -pubout -outform DER -out /tmp/et-pub.der 2>/dev/null
KEY=$(base64 < /tmp/et-pub.der | tr -d '\n')
EXT_ID=$(shasum -a 256 /tmp/et-pub.der | head -c 32 | tr 0-9a-f a-p)
sed -i.bak "s|\"manifest_version\": 3,|\"manifest_version\": 3,\n  \"key\": \"$KEY\",|" extension/manifest.json && rm extension/manifest.json.bak /tmp/et-pub.der
echo "$EXT_ID"
```

Check: `node -e 'JSON.parse(require("fs").readFileSync("extension/manifest.json"))'` exits silently. Write down `EXT_ID`. The private half of the key is never saved: an unpacked extension doesn't need it.

## Step 4: Google Cloud

Never give menu paths: after creating a project, the console stays on whichever project was open before. Links with `?project=<id>` skip that trap.

First, alone: https://console.cloud.google.com/projectcreate → name it (e.g. `email-tracker`) → **Create**. Have them paste the **Project ID** shown under the name field.

Then send all four of these in one message, with `<id>` filled in. They're independent, so one message saves three round trips:

1. `https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=<id>` → **Enable**. Without it, *Connect Gmail* fails with a 403.
2. `https://console.cloud.google.com/auth/overview/create?project=<id>` → app name `Email Tracker`, their email as support email → **Next** → *External* → **Next** → their email as contact → **Next** → tick the policy → **Continue** → **Create**.
3. `https://console.cloud.google.com/auth/audience?project=<id>` → **Add users** → every Gmail address they'll send from → **Save**. Then check that the addresses show in the *Test users* table: Save can fail silently, and a missing address gets "Access blocked" in Step 7.
4. `https://console.cloud.google.com/auth/clients/create?project=<id>` → *Web application* → *Authorized JavaScript origins* → **Add URI** → the dashboard alias → *Authorized redirect URIs* → **Add URI** → `https://<EXT_ID>.chromiumapp.org/` (with the trailing slash) → **Create** → paste the **client ID** into chat.

They do them in this order: the client in item 4 depends on the app set up in item 2.

Use one client for the dashboard and the extension. The server only accepts ID tokens issued to `GOOGLE_CLIENT_ID`, so a second client gives working sign-in pop-ups followed by 401s. Nothing under *Data Access* needs adding, and the app stays in *Testing*: the extension's `https://mail.google.com/` scope is restricted, and only test users can use it without Google verification.

## Step 5: Fill in the placeholders

```sh
for f in $(git grep -l "YOUR-" -- extension dashboard); do
  sed -i.bak "s/YOUR-SERVER\.example/<app>.fly.dev/g; s/YOUR-DASHBOARD\.example/<dashboard host>/g; s/YOUR-GOOGLE-CLIENT-ID/<client id>/g" "$f" && rm "$f.bak"
done
```

`<dashboard host>` is the alias without `https://`. Only the token is swapped, so the `https://…/*` patterns in `manifest.json` and the scheme-less host in `gmail.js` stay correct.

Check: `git grep "YOUR-" -- extension dashboard` returns nothing. Then run `vercel deploy --prod --yes --cwd dashboard` and confirm the alias didn't change.

## Step 6: Deploy the server

Have the user run this in their own terminal, with their values filled in:

```sh
fly secrets set -a <app> DATABASE_URL='<Supabase URI with the password filled in>' \
  HMAC_KEY="$(openssl rand -base64 32)" \
  GOOGLE_CLIENT_ID='<client id>' \
  OWNER_EMAIL='<gmail 1>,<gmail 2>' \
  DASHBOARD_ORIGIN='https://<dashboard host>'
```

`OWNER_EMAIL` is the allow-list for sign-in: every Gmail address they send from, separated by commas.

Once they say it's done, run `fly deploy --ha=false` from `server/`. Without `--ha=false`, Fly creates 2 machines; one is plenty for one person.

Check: `curl -s -o /dev/null -w '%{http_code}\n' https://<app>.fly.dev/stats` prints `401`.

```
Not 401?
├── Connection refused or timeout → `fly logs -a <app>`: the machine crashed on boot
│   ├── "must be set" → a secret is missing or misspelled; `fly secrets list -a <app>`
│   ├── "applying schema" or a pgx error → DATABASE_URL is wrong: password not filled in,
│   │   or special characters not percent-encoded (Step 3)
│   └── other → read the log line and fix it; never redeploy blind
└── 404 → the request isn't reaching this app; check the host
```

## Step 7: Load the extension

1. `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → the `extension/` folder inside the clone. The setup page opens by itself.
2. Have them check that the ID on the extension's card matches `EXT_ID`. If it doesn't, the key line is broken: fix it, reload the extension, then update the redirect URI at `https://console.cloud.google.com/auth/clients/<client id>?project=<project id>`. Google can take up to 5 minutes to apply a redirect change; a `redirect_uri_mismatch` right after saving means wait, not redo.
3. On the setup page (or from the toolbar button), for each Gmail account: **Sign in** on the dashboard, then **Connect Gmail**. Google shows "Google hasn't verified this app": that's expected for a personal app in *Testing*. Click **Continue**, then allow access. The account then shows **✓ Ready**.
4. Have them turn off other email trackers (Mailtrack and similar). Those rewrite the same links and break tracking.
5. Have them reload any open Gmail tabs. Tabs opened before the extension loaded don't have its scripts.

## Step 8: Prove it works end to end

Have the user send an email from Gmail to **a different address they own**, and open it on their phone or in another browser. The extension blocks the tracking image in every Gmail tab of the browser it's installed in, so a recipient inbox in that same browser never counts, and neither does their own Sent copy.

1. Before sending, the compose window shows **✓ Tracked**. After sending, Gmail shows "Tracked. Opens will show up here and on your dashboard." A "Not tracked: …" toast means registration failed; its text says why. The email appears on the dashboard within a few seconds.
2. They open the email in the other inbox, with images on.
3. Within about a minute, the dashboard and the sent email in Gmail both show 1 open.

```
No open after 2 minutes?
├── Email not on the dashboard → registration failed: check the extension's
│   service worker console (chrome://extensions → Inspect) and `fly logs -a <app>` for POST /mails
├── On the dashboard, no GET /o/ in `fly logs` → the recipient's client blocked images,
│   or Google's image proxy cached the pixel; open it in a fresh client
└── GET /o/ logged but count is 0 → it was an own view (the extension marks those with ?me,
    which the log line doesn't show); open it from the other account, in another browser
```

Setup is done when this check passes. Finish by giving the user their dashboard URL. If they don't want their URLs public, remind them that their filled-in copy shouldn't be pushed to a public fork.
