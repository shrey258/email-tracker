// Must match sign() in server/sign.go: base64url(HMAC-SHA256(key, purpose + ":" + id)), no padding.
async function sign(key, purpose, id) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`${purpose}:${id}`)));
  return btoa(String.fromCharCode(...mac)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// Your tracking server (deploy server/ first), e.g. "https://my-tracker.fly.dev". No trailing slash.
// Also set it in manifest.json host_permissions and in TRACKER in content.js.
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

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== "register") return;
  register(msg)
    .then((r) => reply({ ok: true, ...r }))
    .catch((e) => reply({ ok: false, error: e.message }));
  return true; // reply is async
});
