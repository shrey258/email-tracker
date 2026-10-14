import { BASE } from "./api.js";

const HOST = BASE.replace(/[.\/]/g, "\\$&");
const OPEN_URL = "o/([\\w-]+)/[\\w-]+";
const CLICK_URL = "c/([\\w-]+)/[\\w-]+/\\d+";
const TRACKING_URL = new RegExp(`${HOST}/(?:${OPEN_URL}|${CLICK_URL})(?![\\w/?-])`, "g");

export function markOwnCopy(rawBase64url, yourIds) {
  const before = fromBase64url(rawBase64url);
  const after = rewritePart(before, yourIds);
  return after === before ? null : toBase64url(after);
}

function rewritePart(part, yourIds) {
  const split = part.search(/\r?\n\r?\n/);
  if (split < 0) return part;

  const head = part.slice(0, split);
  const body = part.slice(split);
  const type = header(head, "Content-Type");
  const boundary = type.match(/boundary="?([^";]+)"?/i)?.[1];

  if (/^multipart\//i.test(type) && boundary) return head + rewriteMultipart(body, boundary, yourIds);
  if (/^\s*text\/html/i.test(type)) return rewriteHtml(head, body, yourIds) ?? part;
  return part;
}

function rewriteMultipart(body, boundary, yourIds) {
  const parts = body.split(`--${boundary}`);
  const inner = (i) => i > 0 && i < parts.length - 1;
  return parts.map((p, i) => (inner(i) ? rewritePart(p, yourIds) : p)).join(`--${boundary}`);
}

function rewriteHtml(head, body, yourIds) {
  const decoder = decoderFor(header(head, "Content-Type"));
  if (!decoder) return null;
  const html = decode(body.replace(/^\r?\n\r?\n/, ""), header(head, "Content-Transfer-Encoding"), decoder);
  const marked = html.replace(TRACKING_URL, (url, openId, clickId) => (yourIds.has(openId ?? clickId) ? `${url}?me` : url));
  if (marked === html) return null;

  const headWithoutEncoding = head
    .replace(/^Content-Transfer-Encoding:.*(\r?\n[ \t].*)*\r?\n?/im, "")
    .replace(/charset="?[^";\s]+"?/i, "charset=utf-8")
    .trimEnd();
  const base64Lines = utf8ToBase64(marked).replace(/.{76}/g, "$&\r\n");
  return `${headWithoutEncoding}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines}\r\n`;
}

function header(head, name) {
  const unfolded = head.replace(/\r?\n[ \t]+/g, " ");
  return unfolded.match(new RegExp(`^${name}:\\s*(.*)$`, "im"))?.[1] ?? "";
}

function decoderFor(type) {
  try {
    return new TextDecoder(type.match(/charset="?([^";\s]+)/i)?.[1] ?? "utf-8");
  } catch {
    return null;
  }
}

function decode(body, encoding, decoder) {
  let bytes = body;
  if (/quoted-printable/i.test(encoding)) bytes = decodeQuotedPrintable(body);
  else if (/base64/i.test(encoding)) bytes = atob(body.replace(/\s/g, ""));
  return decoder.decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
}

function decodeQuotedPrintable(body) {
  return body
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function utf8ToBase64(text) {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64url(s) {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

function toBase64url(s) {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
