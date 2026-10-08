import { sign } from "./sign.js";

const BASE = "https://YOUR-SERVER.example";

// The HMAC key lives only here (chrome.storage), never in the Gmail page.
async function register({ subject, recipients, links }) {
  const { hmacKey } = await chrome.storage.local.get("hmacKey");
  if (!hmacKey) throw new Error("no HMAC key set (open the extension's options)");

  const id = crypto.randomUUID();
  const res = await fetch(`${BASE}/mails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, sig: await sign(hmacKey, "write", id), subject, recipients, links }),
    signal: AbortSignal.timeout(5000), // a cold Fly machine or paused DB can't hold the email hostage
  });
  if (!res.ok) throw new Error(`server said ${res.status}`);
  return { id, base: BASE, trackSig: await sign(hmacKey, "track", id) };
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== "register") return;
  register(msg)
    .then((r) => reply({ ok: true, ...r }))
    .catch((e) => reply({ ok: false, error: e.message }));
  return true; // reply is async
});
