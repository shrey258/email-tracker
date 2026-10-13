import { gmailToken } from "./google-auth.js";

async function request(account, path, init) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${await gmailToken(account)}` },
  });
  if (!res.ok) throw new Error(`Gmail said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

export async function gmail(account, path, body) {
  const res = await request(account, path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  return res.json();
}

export async function gmailDelete(account, path) {
  await request(account, path, { method: "DELETE" });
}
