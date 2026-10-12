new MutationObserver(() => {
  for (const b of document.querySelectorAll(SEND)) if (!b.dataset.et) takeOver(b);
  for (const img of document.querySelectorAll(PIXEL)) showStats(img);
  markRows();
}).observe(document, { childList: true, subtree: true });

setTimeout(showSetupBanner, 4000);
