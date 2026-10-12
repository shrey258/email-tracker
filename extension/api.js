// Talking to the server as one of your Gmail accounts.
export const BASE = "https://YOUR-SERVER.example";
export const DASHBOARD = "https://YOUR-DASHBOARD.example";

// One session per Gmail account, from signing in on the dashboard as that account (see dashboard.js).
// Each tab sends with the session of the account it's signed in as, so tabs for different accounts work side by side.
// The server renews them on every request. They live only here (chrome.storage), never in the Gmail page.
// One storage key per account, so two tabs renewing at once can't overwrite each other's session.
const key = (account) => `session:${account}`;
export async function setSession(account, session) {
  if (session) await chrome.storage.local.set({ [key(account)]: session });
  else await chrome.storage.local.remove(key(account));
}

export async function api(account, path, init = {}) {
  const signedOut = new Error(`${account || "this account"} isn't signed in. Sign in as it at ${DASHBOARD}`);
  const session = account && (await chrome.storage.local.get(key(account)))[key(account)];
  if (!session) throw signedOut;
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${session}` },
    signal: AbortSignal.timeout(5000), // a cold Fly machine or paused DB can't hold the email hostage
  });
  if (res.status === 401) {
    await setSession(account, null);
    throw signedOut;
  }
  if (!res.ok) throw new Error(`server said ${res.status}`);
  const renewed = res.headers.get("X-Session");
  if (renewed) await setSession(account, renewed);
  return res.json();
}
