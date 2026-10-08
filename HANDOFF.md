# Handoff: email tracker (Gmail open/click tracker)

Repo: `/Users/shrey/Documents/personal/email_tracker` · GitHub: https://github.com/shrey258/email-tracker (public)

## Read these first (source of truth, don't duplicate)
- `.vibe-wise/profile.md`: learner profile and preferences (learning mode is **active**).
- `.vibe-wise/project-map.md`: confirmed design, components, flow, trust boundaries, deployment.
- `.vibe-wise/progress.md`: every decision made so far, who made it, concepts taught, and the **Pending decision** section.
- Code: `server/` (Go API) and `extension/` (Chrome MV3, plain JS). File roles are listed in project-map.md.

## Working mode
VibeWise learn mode is active; follow `.vibe-wise/profile.md` and the skills below.

## Current state (verified this session)
- **Piece 1, server: live** at https://YOUR-SERVER.example (Fly app `YOUR-FLY-APP`, region sjc, stops when idle). Database: Supabase project `email-tracker` (us-west-1). `server/test.sh` passed all live HTTP checks, and the database showed the expected counts.
- Secrets are in macOS Keychain: `email-tracker-hmac-key` and `email-tracker-db-pw` (the password for the `tracker` database user). The same values are set as Fly secrets. Never print them; read them with `security find-generic-password -s <name> -w`.
- **Piece 2a, extension (send path): written but NOT tested in real Gmail.** Only verified: signatures created by `extension/sign.js` are accepted by the Go server (register returned 201, click returned 302 against the local server).
- One test email (ID starting `test-`) and its opens and clicks are still in the live database. Shrey declined my cleanup.

## Next step
Waiting on Shrey's real Gmail test of stage 2a. Instructions are in the last assistant message: load `extension/` unpacked, paste the key into Options, and send to his own second address both with the button and with Cmd+Enter. **Unverified risks** to debug when he reports back:
- The Gmail selectors in `extension/content.js` (Send button `div[role=button].aoO`, body, `subjectbox`, recipient chips `[email]`) haven't been checked against current Gmail markup.
- Gmail may not respond to the faked mouse events in `pressGmailSend`.
- Gmail's editor may not keep changes made directly to its body (rewritten links, pixel) when the email is actually sent.
- Expect a false open on every email until stage 2b exists.

After that: **2b**, blocking your own opens (decided: block if the HMAC signature is valid OR the sender is the logged-in account; mechanism undecided, and `declarativeNetRequest` probably can't see the URL fragment in Gmail's proxied image URLs, which is unverified). Then **2c**, stats inside Gmail plus the Gmail-ID PATCH. Then **piece 3**: `/stats` endpoint with Google-login verification, CORS, and the dashboard on Vercel.

At the very end of the whole task, tell Shrey in one line how his estimate compared with reality: he guessed "1 hour, approach: don't know".

## Suggested skills (call with the Skill tool)
- `vibe-wise:learn`: resume learning mode (reads `.vibe-wise/`).
- `own-the-decision`: Shrey's required decision workflow.
- `work-in-public`: one-line reminders at milestones.
- `argent-device-interact` or `browser-testing-with-devtools`: only if you help debug the extension in a browser.
- `vercel:nextjs` or `vercel:deploy`: when piece 3 (the Vercel dashboard) starts.
