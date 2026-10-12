// The extension's background: registers emails, fetches stats, stores sign-ins, and blocks
// your own Gmail tabs from loading the pixel. Server calls go through api.js.
import { BASE, api, setSession } from "./api.js";

async function register({ account, subject, recipients, links }) {
  const id = crypto.randomUUID();
  const { track_sig } = await api(account, "/mails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, subject, recipients, links }),
  });
  return { id, base: BASE, trackSig: track_sig };
}

// ponytail: refetches the account's stats at most every 30s; add a per-email endpoint if this gets slow.
const cache = {};
async function stats({ account, id }) {
  if (!(Date.now() - cache[account]?.at < 30000))
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
};

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const h = handlers[msg.type];
  if (!h) return;
  h(msg)
    .then((r) => reply({ ok: true, ...r }))
    .catch((e) => reply({ ok: false, error: e.message }));
  return true; // reply is async
});
