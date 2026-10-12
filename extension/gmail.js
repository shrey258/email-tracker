// Gmail markup we depend on. When Gmail changes its page, these are what break.
const SEND = 'div[role="button"].aoO:not([data-et-ours])';
const BODY = 'div[contenteditable="true"][g_editable="true"], div[contenteditable="true"][aria-label="Message Body"]';
const SUBJECT = 'input[name="subjectbox"]';
const RECIPIENT = "[email]"; // recipient chips carry the address in an `email` attribute
const TRACKER = "YOUR-SERVER.example";
const GMAIL_SEND = 'div[role="button"].aoO[data-et]:not([data-et-ours])';
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

// The Gmail account this tab is signed in as: from the account button, else the page title's last address.
function account() {
  const label = document.querySelector('a[aria-label^="Google Account"]')?.getAttribute("aria-label") ?? "";
  return (label.match(EMAIL) ?? document.title.match(EMAIL) ?? []).at(-1)?.toLowerCase();
}

// The compose window an element is in. partial = found its body and Send but not its subject.
function composeRoot(el) {
  let fallback;
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (n.querySelectorAll(BODY).length > 1) break;
    if (n.querySelector(SUBJECT)) return { root: n, partial: false };
    if (!fallback && n.querySelector(BODY) && n.querySelector(GMAIL_SEND)) fallback = n;
  }
  return fallback && { root: fallback, partial: true };
}
