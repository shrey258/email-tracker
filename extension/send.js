// Our Send button: registers the email with the server, rewrites its links, adds the pixel,
// then presses Gmail's real Send. If anything fails, the email goes out untouched.

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
  if (alreadyTracked(root.querySelector(BODY))) return pressGmailSend(gmailSend); // sending again after Undo
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
      account: account(),
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

  // 3. Press Gmail's real Send, then mark your own copy once it's in Sent.
  pressGmailSend(gmailSend);
  if (r.ok) afterSend();
  delete root.dataset.etBusy;
}

// Gmail's Send is a div listening for mouse events, so a plain .click() may not be enough.
function pressGmailSend(btn) {
  btn.style.display = "";
  for (const t of ["mousedown", "mouseup", "click"]) {
    btn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
  }
}

// After Undo, Gmail reopens the draft with our pixel still in it; it's already registered.
function alreadyTracked(body) {
  return [...body.querySelectorAll(`img[src*="${TRACKER}/o/"]`)].some((img) => !img.closest(".gmail_quote, blockquote"));
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
