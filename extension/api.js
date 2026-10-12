export const BASE = "https://YOUR-SERVER.example";
export const DASHBOARD = "https://YOUR-DASHBOARD.example";

const key = (account) => `session:${account}`;

export async function getSession(account) {
  return (await chrome.storage.local.get(key(account)))[key(account)];
}

export async function setSession(account, session) {
  if (session) await chrome.storage.local.set({ [key(account)]: session });
  else await chrome.storage.local.remove(key(account));
}

export async function signedInAccounts() {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all).filter((k) => k.startsWith("session:")).map((k) => k.slice("session:".length));
}

export async function api(account, path, init = {}) {
  const signedOut = new Error(`${account || "this account"} isn't signed in. Sign in as it at ${DASHBOARD}`);
  const session = account && (await getSession(account));
  if (!session) throw signedOut;

  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${session}` },
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 401) {
    await setSession(account, null);
    throw signedOut;
  }
  if (!res.ok) throw new Error(`server said ${res.status}`);

  const renewed = res.headers.get("X-Session");
  if (renewed && (await getSession(account))) await setSession(account, renewed);
  return res.json();
}
