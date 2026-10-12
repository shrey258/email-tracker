// Shows opens and clicks above each tracked email you sent, found by the pixel we put in it.
// Pixels inside quoted text belong to earlier emails, so those are skipped.
const PIXEL = `div.a3s img[src*="${TRACKER}/o/"]:not([data-et-seen])`;
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function ago(t) {
  const s = (new Date(t) - Date.now()) / 1000;
  for (const [unit, n] of [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]])
    if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit);
  return "just now";
}

async function showStats(img) {
  img.dataset.etSeen = "1";
  if (img.closest(".gmail_quote, blockquote")) return;
  const id = img.src.split(`${TRACKER}/o/`)[1]?.split("/")[0]; // Gmail's proxy URL carries ours after "#"
  const msg = img.closest("div.a3s");
  if (!id || msg.previousElementSibling?.dataset.etStats) return;
  const r = await chrome.runtime.sendMessage({ type: "stats", account: account(), id }).catch((e) => ({ ok: false, error: e.message }));
  if (r.ok && !r.mail) return; // not ours, or older than the newest 200
  const opens = r.mail?.opens ?? [], clicks = r.mail?.clicks ?? [];
  const text = !r.ok ? `Email Tracker: ${r.error}`
    : opens.length ? `Opened ${opens.length}× · last ${ago(opens.at(-1))}` : "Not opened yet";
  const line = Object.assign(document.createElement("div"), {
    textContent: clicks.length ? `${text} · ${clicks.length} click${clicks.length > 1 ? "s" : ""}` : text,
    title: [...opens.map((t) => `Opened ${new Date(t).toLocaleString()}`), ...clicks.map((c) => `Clicked ${c.url} ${new Date(c.at).toLocaleString()}`)].join("\n"),
  });
  line.dataset.etStats = "1";
  Object.assign(line.style, { font: "12px/1.5 'Google Sans', Roboto, sans-serif", color: opens.length ? "#188038" : "#5f6368", margin: "0 0 8px" });
  msg.before(line);
}
