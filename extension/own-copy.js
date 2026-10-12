// Your mailbox holds copies of your tracked emails: your Sent copy, and the quote inside every reply
// to it. Opening any of those on any device (phone, other browsers) would count as an open, so each
// one is swapped (through the Gmail API) for a copy whose tracking URLs end in "?me", which the server
// ignores. Only URLs of emails this account sent change, so emails from your other accounts still count.
// The new copy is saved first; only then does the old one go to Trash.
import { api } from "./api.js";
import { gmail } from "./gmail-api.js";
import { markOwnCopy } from "./mime.js";

const checked = new Set(); // message ids already looked at, so each is fetched once per browser session
const running = {}; // account -> the sweep in progress, so two can't copy the same email twice

export function markOwnCopies(account) {
  running[account] ??= sweep(account).finally(() => delete running[account]);
  return running[account];
}

// ponytail: looks at the 20 newest emails from the last 2 days, every minute; widen if more arrive between sweeps.
async function sweep(account) {
  const { messages = [] } = await gmail(account, `/messages?maxResults=20&q=${encodeURIComponent("newer_than:2d -in:drafts")}`);
  const fresh = messages.filter(({ id }) => !checked.has(id));
  if (!fresh.length) return { marked: 0 };
  const yourIds = new Set((await api(account, "/stats")).map((m) => m.id));
  let marked = 0;
  for (const { id } of fresh) {
    const msg = await gmail(account, `/messages/${id}?format=raw`);
    const raw = !msg.labelIds.includes("DRAFT") && markOwnCopy(msg.raw, yourIds); // never touch a draft you're editing
    if (raw) {
      const labelIds = msg.labelIds.filter((l) => l !== "CHAT");
      // ponytail: plain JSON insert, fine for normal emails; very large attachments would need Gmail's upload endpoint.
      await gmail(account, "/messages?internalDateSource=dateHeader", { raw, threadId: msg.threadId, labelIds });
      await gmail(account, `/messages/${id}/trash`, {});
      marked++;
    }
    checked.add(id);
  }
  return { marked };
}
