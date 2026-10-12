// Swaps your Sent copy of each recently tracked email for one whose tracking URLs end in "?me",
// so you opening it on any device (phone, other browsers) isn't counted. Recipients' copies are untouched.
// The new copy is saved first; only then does the old one go to Trash.
import { gmail } from "./gmail-api.js";
import { markOwnCopy } from "./mime.js";

const checked = new Set(); // message ids already handled, so each is fetched once per browser session
const running = {}; // account -> the sweep in progress, so two can't copy the same email twice

export function markOwnCopies(account) {
  running[account] ??= sweep(account).finally(() => delete running[account]);
  return running[account];
}

// ponytail: looks at the 10 newest Sent emails from the last 2 days; widen if you send more than that between sweeps.
async function sweep(account) {
  const { messages = [] } = await gmail(account, `/messages?maxResults=10&q=${encodeURIComponent("in:sent newer_than:2d")}`);
  let marked = 0;
  for (const { id } of messages) {
    if (checked.has(id)) continue;
    const msg = await gmail(account, `/messages/${id}?format=raw`);
    const raw = markOwnCopy(msg.raw);
    if (raw) {
      const labelIds = msg.labelIds.filter((l) => l !== "DRAFT" && l !== "CHAT");
      // ponytail: plain JSON insert, fine for normal emails; very large attachments would need Gmail's upload endpoint.
      await gmail(account, "/messages?internalDateSource=dateHeader", { raw, threadId: msg.threadId, labelIds });
      await gmail(account, `/messages/${id}/trash`, {});
      marked++;
    }
    checked.add(id);
  }
  return { marked };
}
