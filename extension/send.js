function takeOver(gmailSend) {
  gmailSend.dataset.et = "1";
  const ours = gmailSend.cloneNode(true);
  for (const attribute of ["id", "jsaction", "jscontroller", "data-tooltip-id"]) ours.removeAttribute(attribute);
  ours.dataset.etOurs = "1";
  ours.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    trackedSend(composeRoot(gmailSend), gmailSend);
  });
  for (const t of ["mousedown", "mouseup"]) ours.addEventListener(t, (e) => e.stopImmediatePropagation());
  gmailSend.before(ours);
  gmailSend.style.display = "none";
  addComposeStatus(ours);
}

async function trackedSend(found, gmailSend) {
  if (!found) {
    toast("Not tracked: couldn't find this email's text. Gmail may have changed its layout.");
    return pressGmailSend(gmailSend);
  }
  const { root, partial } = found;
  const body = root.querySelector(BODY);
  if (root.dataset.etBusy) return;
  if (alreadyTracked(body)) return pressGmailSend(gmailSend);

  root.dataset.etBusy = "1";
  const links = trackableLinks(body);
  const registration = await registerEmail(root, links);
  if (registration.ok) {
    addTracking(body, links, registration);
    toast(partial
      ? "Tracked, but couldn't read the subject and recipients. Gmail may have changed its layout."
      : "Tracked. Opens will show up here and on your dashboard.");
    refreshMarks();
  } else {
    toast(`Not tracked: ${registration.error}`);
  }
  pressGmailSend(gmailSend);
  delete root.dataset.etBusy;
}

function trackableLinks(body) {
  return [...body.querySelectorAll("a[href]")].filter((a) => /^https?:\/\//i.test(a.getAttribute("href")) && !a.href.includes(TRACKER));
}

async function registerEmail(root, links) {
  const recipients = [...new Set([...root.querySelectorAll(RECIPIENT)].map((e) => e.getAttribute("email")))];
  try {
    return await chrome.runtime.sendMessage({
      type: "register",
      account: account(),
      subject: root.querySelector(SUBJECT)?.value ?? "",
      recipients,
      links: links.map((a) => a.href),
    });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function addTracking(body, links, { base, id, trackSig }) {
  links.forEach((a, i) => (a.href = `${base}/c/${id}/${trackSig}/${i + 1}`));
  const img = document.createElement("img");
  img.src = `${base}/o/${id}/${trackSig}`;
  img.width = img.height = 1;
  img.alt = "";
  body.append(img);
}

function pressGmailSend(btn) {
  btn.style.display = "";
  for (const t of ["mousedown", "mouseup", "click"]) {
    btn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
  }
}

function alreadyTracked(body) {
  const pixels = [...body.querySelectorAll(`img[src*="${TRACKER}/o/"]`)];
  return pixels.some((img) => !img.closest(".gmail_quote, blockquote"));
}

function onCmdEnter(e) {
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
}

window.addEventListener("keydown", onCmdEnter, true);
