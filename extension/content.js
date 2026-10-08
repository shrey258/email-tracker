// Gmail markup we depend on. When Gmail changes its page, these are what break.
const SEND = 'div[role="button"].aoO:not([data-et-ours])';
const BODY = 'div[contenteditable="true"][g_editable="true"], div[contenteditable="true"][aria-label="Message Body"]';
const SUBJECT = 'input[name="subjectbox"]';
const RECIPIENT = "[email]"; // recipient chips carry the address in an `email` attribute
const TRACKER = "YOUR-SERVER.example"; // your tracking server's host, same as BASE in background.js
const GMAIL_SEND = 'div[role="button"].aoO[data-et]:not([data-et-ours])';

function composeRoot(el) {
  let fallback;
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (n.querySelectorAll(BODY).length > 1) break;
    if (n.querySelector(SUBJECT)) return { root: n, partial: false };
    if (!fallback && n.querySelector(BODY) && n.querySelector(GMAIL_SEND)) fallback = n;
  }
  return fallback && { root: fallback, partial: true };
}

function takeOver(gmailSend) {
  gmailSend.dataset.et = "1";
  const ours = gmailSend.cloneNode(true); // same look; cloning doesn't copy Gmail's listeners
  for (const a of ["id", "jsaction", "jscontroller", "data-tooltip-id"]) ours.removeAttribute(a);
  ours.dataset.etOurs = "1";
  ours.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    trackedSend(composeRoot(gmailSend), gmailSend);
  });
  // Gmail's own handlers may react to mousedown/up bubbling from the clone, so stop those too.
  for (const t of ["mousedown", "mouseup"]) ours.addEventListener(t, (e) => e.stopImmediatePropagation());
  gmailSend.before(ours);
  gmailSend.style.display = "none";
}

async function trackedSend(found, gmailSend) {
  if (!found) {
    toast("Not tracked: couldn't find this email's text. Gmail may have changed its layout.");
    return pressGmailSend(gmailSend);
  }
  const { root, partial } = found;
  if (root.dataset.etBusy) return;
  root.dataset.etBusy = "1";
  const body = root.querySelector(BODY);
  const links = [...body.querySelectorAll("a[href]")].filter(
    (a) => /^https?:/i.test(a.href) && !a.href.includes(TRACKER) // skip links from quoted tracked emails
  );

  // 1. Register first, while the email is still untouched.
  let r;
  try {
    r = await chrome.runtime.sendMessage({
      type: "register",
      subject: root.querySelector(SUBJECT)?.value ?? "",
      recipients: [...new Set([...root.querySelectorAll(RECIPIENT)].map((e) => e.getAttribute("email")))],
      links: links.map((a) => a.href),
    });
  } catch (e) {
    r = { ok: false, error: e.message };
  }

  // 2. Only rewrite if registration succeeded. On failure, send the email unchanged.
  if (r.ok) {
    links.forEach((a, i) => (a.href = `${r.base}/c/${r.id}/${r.trackSig}/${i + 1}`));
    const img = document.createElement("img");
    img.src = `${r.base}/o/${r.id}/${r.trackSig}`;
    img.width = img.height = 1;
    img.alt = "";
    body.append(img);
    if (partial) toast("Tracked, but couldn't read the subject and recipients. Gmail may have changed its layout.");
  } else {
    toast(`Not tracked: ${r.error}`);
  }

  // 3. Press Gmail's real Send.
  pressGmailSend(gmailSend);
  delete root.dataset.etBusy;
}

// Gmail's Send is a div listening for mouse events, so a plain .click() may not be enough.
function pressGmailSend(btn) {
  btn.style.display = "";
  for (const t of ["mousedown", "mouseup", "click"]) {
    btn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
  }
}

function toast(text) {
  const t = Object.assign(document.createElement("div"), { textContent: text });
  Object.assign(t.style, {
    position: "fixed", bottom: "24px", left: "24px", zIndex: 99999, padding: "10px 14px",
    background: "#202124", color: "#fff", borderRadius: "6px", font: "14px sans-serif",
  });
  document.body.append(t);
  setTimeout(() => t.remove(), 6000);
}

// Cmd/Ctrl+Enter sends without a click. Registered at document_start on window's
// capture phase so it runs before Gmail's own shortcut handler.
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
    const found = composeRoot(e.target);
    const gmailSend = found?.root.querySelector(GMAIL_SEND);
    if (!gmailSend) {
      if (e.target.closest?.(BODY)) toast("Not tracked: couldn't find this email's Send button. Gmail may have changed its layout.");
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    trackedSend(found, gmailSend);
  },
  true
);

// Compose windows appear and re-render at any time; take over each new Send button.
new MutationObserver(() => {
  for (const b of document.querySelectorAll(SEND)) if (!b.dataset.et) takeOver(b);
}).observe(document, { childList: true, subtree: true });
