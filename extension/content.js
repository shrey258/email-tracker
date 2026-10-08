// Gmail markup we depend on. When Gmail changes its page, these are what break.
const SEND = 'div[role="button"].aoO:not([data-et-ours])';
const BODY = 'div[contenteditable="true"][g_editable="true"], div[contenteditable="true"][aria-label="Message Body"]';
const SUBJECT = 'input[name="subjectbox"]';
const RECIPIENT = "[email]"; // recipient chips carry the address in an `email` attribute

// The compose window is the nearest ancestor that contains a message body.
function composeRoot(el) {
  for (let n = el; n; n = n.parentElement) if (n.querySelector?.(BODY)) return n;
}

// Put our button where Gmail's Send is. Gmail's stays in the page, hidden but working,
// because we press it ourselves at the end (a disabled button would ignore that).
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

async function trackedSend(root, gmailSend) {
  if (!root || root.dataset.etBusy) return;
  root.dataset.etBusy = "1";
  const body = root.querySelector(BODY);
  const links = [...body.querySelectorAll("a[href]")].filter(
    (a) => /^https?:/i.test(a.href) && !a.href.includes("YOUR-SERVER.example") // skip links from quoted tracked emails
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
    const root = composeRoot(e.target);
    const gmailSend = root?.querySelector('div[role="button"].aoO[data-et]');
    if (!gmailSend) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    trackedSend(root, gmailSend);
  },
  true
);

// Compose windows appear and re-render at any time; take over each new Send button.
new MutationObserver(() => {
  for (const b of document.querySelectorAll(SEND)) if (!b.dataset.et) takeOver(b);
}).observe(document, { childList: true, subtree: true });
