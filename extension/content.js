// Wires the pieces to Gmail's page: gmail.js (finding things), send.js (tracked sending),
// stats-line.js (opens above your sent emails), own-views.js (your own views don't count), toast.js (messages).
// Compose windows and messages appear and re-render at any time.
new MutationObserver(() => {
  for (const b of document.querySelectorAll(SEND)) if (!b.dataset.et) takeOver(b);
  for (const img of document.querySelectorAll(PIXEL)) showStats(img);
}).observe(document, { childList: true, subtree: true });

// Catch emails sent while no Gmail tab stayed open long enough.
setTimeout(() => markOwnCopies(false), 5000);
