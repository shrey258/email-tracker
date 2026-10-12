import { api } from "./api.js";
import { gmail, gmailDelete } from "./gmail-api.js";
import { markOwnCopy } from "./mime.js";

const checked = new Set();
const running = {};

export function markOwnCopies(account) {
  running[account] ??= sweep(account).finally(() => delete running[account]);
  return running[account];
}

async function sweep(account) {
  const query = encodeURIComponent("newer_than:2d -in:drafts");
  const { messages = [] } = await gmail(account, `/messages?maxResults=20&q=${query}`);
  const fresh = messages.filter(({ id }) => !checked.has(id));
  if (!fresh.length) return { marked: 0 };

  const yourIds = new Set((await api(account, "/stats")).map((m) => m.id));
  let marked = 0;
  for (const { id } of fresh) {
    if (await replaceIfYours(account, id, yourIds)) marked++;
    checked.add(id);
  }
  return { marked };
}

async function replaceIfYours(account, id, yourIds) {
  const msg = await gmail(account, `/messages/${id}?format=raw`);
  if (msg.labelIds.includes("DRAFT")) return false;

  const raw = markOwnCopy(msg.raw, yourIds);
  if (!raw) return false;

  const labelIds = msg.labelIds.filter((l) => l !== "CHAT");
  await gmail(account, "/messages?internalDateSource=dateHeader", { raw, threadId: msg.threadId, labelIds });
  await gmailDelete(account, `/messages/${id}`);
  return true;
}
