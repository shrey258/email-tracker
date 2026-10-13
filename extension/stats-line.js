const PIXEL = `div.a3s img[src*="${TRACKER}/o/"]:not([data-et-seen])`;
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];

function ago(time) {
  const seconds = (new Date(time) - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

async function showStats(img) {
  img.dataset.etSeen = "1";
  if (img.closest(".gmail_quote, blockquote")) return;
  const id = img.src.split(`${TRACKER}/o/`)[1].split("/")[0];
  const message = img.closest("div.a3s");
  if (!id || message.previousElementSibling?.dataset.etStats) return;

  const reply = await chrome.runtime.sendMessage({ type: "stats", account: account(), id }).catch((e) => ({ ok: false, error: e.message }));
  if (reply.ok && !reply.mail) return;
  message.before(statsLine(reply));
}

function statsLine(reply) {
  const opens = reply.mail?.opens ?? [];
  const clicks = reply.mail?.clicks ?? [];
  const line = document.createElement("div");
  line.dataset.etStats = "1";
  if (reply.ok) {
    line.append(checkMark(opens.length > 0), summary(opens, clicks));
    attachHistory(line, opens, clicks);
  } else {
    line.textContent = `Email Tracker: ${reply.error}`;
  }
  Object.assign(line.style, {
    font: "12px/1.5 'Google Sans', Roboto, sans-serif",
    color: opens.length ? BLUE : GREY,
    margin: "0 0 8px",
  });
  return line;
}

function summary(opens, clicks) {
  const opened = opens.length ? `Opened ${opens.length}× · last ${ago(opens.at(-1))}` : "Not opened yet";
  if (!clicks.length) return opened;
  return `${opened} · ${clicks.length} click${clicks.length > 1 ? "s" : ""}`;
}
