// Rewrites a raw email (as the Gmail API returns it) so tracking URLs of your emails end in "?me".
// Only the HTML parts change; they're decoded, edited and saved back as base64.
import { BASE } from "./api.js";

// Our tracking URLs; group 1 is the email's id.
const OURS = new RegExp(`${BASE.replace(/[.\/]/g, "\\$&")}/(?:o/([\\w-]+)/[\\w-]+|c/([\\w-]+)/[\\w-]+/\\d+)(?![\\w/?-])`, "g");

// Returns the new raw email, or null if it has none of yourIds' tracking URLs left to mark.
export function markOwnCopy(rawBase64url, yourIds) {
  const before = fromBase64url(rawBase64url);
  const after = rewritePart(before, yourIds);
  return after === before ? null : toBase64url(after);
}

// A part is headers, a blank line, then a body. Multipart bodies hold more parts between boundaries.
function rewritePart(part, yourIds) {
  const split = part.search(/\r?\n\r?\n/);
  if (split < 0) return part;
  const head = part.slice(0, split), body = part.slice(split);
  const type = header(head, "Content-Type");
  const boundary = type.match(/boundary="?([^";]+)"?/i)?.[1];
  if (/^multipart\//i.test(type) && boundary) {
    return head + body.split(`--${boundary}`).map((p, i, all) => (i === 0 || i === all.length - 1 ? p : rewritePart(p, yourIds))).join(`--${boundary}`);
  }
  if (!/^\s*text\/html/i.test(type)) return part;
  const html = decode(body.replace(/^\r?\n\r?\n/, ""), header(head, "Content-Transfer-Encoding"));
  const marked = html.replace(OURS, (url, openId, clickId) => (yourIds.has(openId ?? clickId) ? `${url}?me` : url));
  if (marked === html) return part;
  const newHead = head.replace(/^Content-Transfer-Encoding:.*(\r?\n[ \t].*)*\r?\n?/im, "").replace(/\s*$/, "");
  return `${newHead}\r\nContent-Transfer-Encoding: base64\r\n\r\n${utf8ToBase64(marked).replace(/.{76}/g, "$&\r\n")}\r\n`;
}

// Value of a header, with folded lines joined.
function header(head, name) {
  return head.replace(/\r?\n[ \t]+/g, " ").match(new RegExp(`^${name}:\\s*(.*)$`, "im"))?.[1] ?? "";
}

// Body bytes (as a binary string) to text, per its transfer encoding.
function decode(body, encoding) {
  let bytes = body;
  if (/quoted-printable/i.test(encoding)) bytes = body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  else if (/base64/i.test(encoding)) bytes = atob(body.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
}

function utf8ToBase64(text) {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}
const fromBase64url = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
const toBase64url = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
