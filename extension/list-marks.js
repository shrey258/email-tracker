let listCache = { at: 0, fresh: false, bySubject: new Map() };

function refreshMarks() {
  listCache = { at: 0, fresh: true, bySubject: listCache.bySubject };
}

function normalSubject(subject) {
  return subject.replace(/^((re|fwd?|fw):\s*)+/i, "").trim().toLowerCase();
}

async function trackedBySubject() {
  if (Date.now() - listCache.at < 30000) return listCache.bySubject;
  const fresh = listCache.fresh;
  listCache.at = Date.now();
  listCache.fresh = false;
  const result = await chrome.runtime.sendMessage({ type: "statsList", account: account(), fresh }).catch(() => null);
  const bySubject = new Map();
  for (const mail of result?.ok ? result.mails : []) {
    const key = normalSubject(mail.subject);
    if (key && !bySubject.has(key)) bySubject.set(key, mail);
  }
  listCache.bySubject = bySubject;
  return bySubject;
}

async function markRows() {
  const rows = [...document.querySelectorAll("tr.zA")].filter((row) => !row.querySelector("[data-et-mark]"));
  if (!rows.length) return;
  const bySubject = await trackedBySubject();
  for (const row of rows) {
    const subject = row.querySelector(".bog");
    const mail = subject && bySubject.get(normalSubject(subject.textContent));
    if (!mail || row.querySelector("[data-et-mark]")) continue;
    const mark = checkMark(mail.opens.length > 0);
    mark.title = summary(mail.opens, mail.clicks);
    subject.before(mark);
  }
}

setInterval(() => {
  listCache.at = 0;
  document.querySelectorAll("tr.zA [data-et-mark]").forEach((mark) => mark.remove());
  markRows();
}, 60000);
