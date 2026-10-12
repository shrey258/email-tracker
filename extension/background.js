// The extension's background: registers emails, fetches stats, stores sign-ins, and blocks
// your own Gmail tabs from loading the pixel. Server calls go through api.js.
import { BASE, api, setSession } from "./api.js";
import { gmailToken } from "./google-auth.js";
import { markOwnCopies } from "./own-copy.js";

async function register({ account, subject, recipients, links }) {
  const id = crypto.randomUUID();
  const { track_sig } = await api(account, "/mails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, subject, recipients, links }),
  });
  return { id, base: BASE, trackSig: track_sig };
}

// ponytail: fetches all of the account's stats (newest 200) and keeps them 30s; add a per-email endpoint if this gets slow.
const cache = {};
async function stats({ account, id }) {
  const age = Date.now() - (cache[account]?.at ?? 0);
  // Refetch when stale, or when the email isn't in it yet (sent after the last fetch), at most every 3s.
  if (age > 30000 || (!cache[account].byId[id] && age > 3000))
    cache[account] = { at: Date.now(), byId: Object.fromEntries((await api(account, "/stats")).map((m) => [m.id, m])) };
  return { mail: cache[account].byId[id] ?? null };
}

// Block our pixel whenever your own Gmail tab loads it: directly (the compose window at send time) or
// through Google's image proxy (viewing Sent or a thread), whose URL carries ours after "#".
// Recipients' Gmail runs without this extension, so their opens still count.
chrome.runtime.onInstalled.addListener(() =>
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1,
      action: { type: "block" },
      condition: { urlFilter: `${new URL(BASE).host}/o/`, initiatorDomains: ["mail.google.com"], resourceTypes: ["image"] },
    }],
  })
);

const handlers = {
  register,
  stats,
  // A session is "<expiry>.<email>.<signature>", so it says which account it's for.
  session: ({ session }) => setSession(session.slice(session.indexOf(".") + 1, session.lastIndexOf(".")), session),
  // Only for accounts signed in to the tracker, so we never touch another mailbox.
  ownCopies: async ({ account }) => ((await signedInAccounts()).includes(account) ? markOwnCopies(account) : { marked: 0 }),
  connectGmail: async ({ account }) => (await gmailToken(account, true), {}),
};

const signedInAccounts = async () => Object.keys(await chrome.storage.local.get(null)).filter((k) => k.startsWith("session:")).map((k) => k.slice(8));

// Every minute, swap your copies of tracked emails in each signed-in mailbox (see own-copy.js), so a reply
// arriving with your email quoted is fixed before you open it on your phone. The last error per account
// is kept for the options page.
chrome.alarms.create("own-copies", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name !== "own-copies") return;
  for (const account of await signedInAccounts()) {
    const error = await markOwnCopies(account).then(() => "", (e) => e.message);
    await chrome.storage.local.set({ [`gmailError:${account}`]: error });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const h = handlers[msg.type];
  if (!h) return;
  h(msg)
    .then((r) => reply({ ok: true, ...r }))
    .catch((e) => reply({ ok: false, error: e.message }));
  return true; // reply is async
});
