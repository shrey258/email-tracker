import { BASE, api, setSession, signedInAccounts } from "./api.js";
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

const cache = {};

async function fetchStats(account) {
  const mails = await api(account, "/stats");
  return { at: Date.now(), byId: Object.fromEntries(mails.map((m) => [m.id, m])) };
}

async function stats({ account, id }) {
  const age = cache[account] ? Date.now() - cache[account].at : Infinity;
  const missing = !cache[account]?.byId[id];
  if (age > 30000 || (missing && age > 3000)) cache[account] = await fetchStats(account);
  return { mail: cache[account].byId[id] ?? null };
}

function accountOf(session) {
  return session.slice(session.indexOf(".") + 1, session.lastIndexOf("."));
}

async function ownCopies({ account }) {
  const accounts = await signedInAccounts();
  return accounts.includes(account) ? markOwnCopies(account) : { marked: 0 };
}

async function connectGmail({ account }) {
  await gmailToken(account, true);
  return {};
}

const handlers = {
  register,
  stats,
  session: ({ session }) => setSession(accountOf(session), session),
  ownCopies,
  connectGmail,
};

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const handler = handlers[msg.type];
  if (!handler) return;
  handler(msg)
    .then((result) => reply({ ok: true, ...result }))
    .catch((e) => reply({ ok: false, error: e.message }));
  return true;
});

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

chrome.alarms.create("own-copies", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name !== "own-copies") return;
  for (const account of await signedInAccounts()) {
    const error = await markOwnCopies(account).then(() => "", (e) => e.message);
    await chrome.storage.local.set({ [`gmailError:${account}`]: error });
  }
});
