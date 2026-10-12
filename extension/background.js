import { BASE, api, setSession, signedInAccounts } from "./api.js";
import { forgetGmail, gmailToken } from "./google-auth.js";
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

async function cachedStats(account, wantFresh) {
  const age = cache[account] ? Date.now() - cache[account].at : Infinity;
  if (age > 30000 || (wantFresh && age > 3000)) cache[account] = await fetchStats(account);
  return cache[account];
}

async function stats({ account, id }) {
  const missing = !cache[account]?.byId[id];
  return { mail: (await cachedStats(account, missing)).byId[id] ?? null };
}

async function statsList({ account, fresh }) {
  return { mails: Object.values((await cachedStats(account, fresh)).byId) };
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
  await chrome.storage.local.set({ [`gmailError:${account}`]: "" });
  return {};
}

async function setupStatus({ account }) {
  const all = await chrome.storage.local.get(null);
  return {
    signedIn: `session:${account}` in all,
    gmailConnected: all[`gmailError:${account}`] === "",
    disconnected: `disconnected:${account}` in all,
  };
}

async function receiveSession({ session, fromLoad }) {
  const account = accountOf(session);
  if (fromLoad && `disconnected:${account}` in (await chrome.storage.local.get(`disconnected:${account}`))) return {};
  await chrome.storage.local.remove(`disconnected:${account}`);
  await setSession(account, session);
  return {};
}

async function disconnect({ account }) {
  await forgetGmail(account);
  await chrome.storage.local.remove([`session:${account}`, `gmailError:${account}`]);
  await chrome.storage.local.set({ [`disconnected:${account}`]: Date.now() });
  return {};
}

async function openSetup() {
  await chrome.runtime.openOptionsPage();
  return {};
}

async function updateBadge() {
  const all = await chrome.storage.local.get(null);
  const accounts = await signedInAccounts();
  const done = accounts.length > 0 && accounts.every((a) => all[`gmailError:${a}`] === "");
  await chrome.action.setBadgeText({ text: done ? "" : "!" });
  await chrome.action.setBadgeBackgroundColor({ color: "#d93025" });
}

const handlers = {
  register,
  stats,
  statsList,
  session: receiveSession,
  disconnect,
  ownCopies,
  connectGmail,
  setupStatus,
  openSetup,
};

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const handler = handlers[msg.type];
  if (!handler) return;
  handler(msg)
    .then((result) => reply({ ok: true, ...result }))
    .catch((e) => reply({ ok: false, error: e.message }));
  return true;
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener(updateBadge);
updateBadge();

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
