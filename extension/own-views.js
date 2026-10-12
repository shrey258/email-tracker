// Has the background swap your Sent copies so your own views don't count (see own-copy.js):
// a few times after each send, since an email only reaches Sent after Gmail's Undo window, and once when Gmail opens.
function markOwnCopies(warn) {
  chrome.runtime.sendMessage({ type: "ownCopies", account: account() }).then((r) => {
    if (!r.ok && warn) toast(`Your own views of this email will still count: ${r.error}. Connect Gmail in the Email Tracker options.`);
  }).catch(() => {});
}

function afterSend() {
  setTimeout(() => markOwnCopies(true), 15000);
  setTimeout(() => markOwnCopies(false), 45000);
  setTimeout(() => markOwnCopies(false), 90000);
}
