import { gmailToken } from "./google-auth.js";

export async function gmail(account, path, body) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${await gmailToken(account)}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gmail said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
