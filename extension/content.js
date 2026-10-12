new MutationObserver(() => {
  for (const b of document.querySelectorAll(SEND)) if (!b.dataset.et) takeOver(b);
  for (const img of document.querySelectorAll(PIXEL)) showStats(img);
}).observe(document, { childList: true, subtree: true });
