// Must match sign() in server/sign.go: base64url(HMAC-SHA256(key, purpose + ":" + id)), no padding.
export async function sign(key, purpose, id) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`${purpose}:${id}`)));
  return btoa(String.fromCharCode(...mac)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
