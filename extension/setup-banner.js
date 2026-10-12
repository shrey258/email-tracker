let bannerShown = false;

async function showSetupBanner() {
  const who = account();
  if (bannerShown || !who) return;
  const seenKey = `seen:${who}`;
  if (!(seenKey in (await chrome.storage.local.get(seenKey)))) await chrome.storage.local.set({ [seenKey]: Date.now() });
  const status = await chrome.runtime.sendMessage({ type: "setupStatus", account: who }).catch(() => null);
  if (!status?.ok || status.disconnected || (status.signedIn && status.gmailConnected)) return;
  bannerShown = true;
  const banner = setupBanner(who, status.signedIn);
  document.body.append(banner);
  slideIn(banner);
}

function setupBanner(who, signedIn) {
  const banner = document.createElement("div");
  const text = signedIn
    ? `Email Tracker: connect Gmail for ${who}, or your own views of your emails will count as opens.`
    : `Email Tracker isn't set up for ${who}. Emails you send from it won't be tracked.`;
  const setUp = Object.assign(document.createElement("button"), { textContent: "Set up" });
  setUp.onclick = () => {
    chrome.runtime.sendMessage({ type: "openSetup" });
    slideOut(banner);
  };
  const close = Object.assign(document.createElement("button"), { textContent: "✕", title: "Dismiss" });
  close.onclick = () => slideOut(banner);
  banner.append(text, setUp, close);
  Object.assign(banner.style, {
    position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", zIndex: 99999, display: "flex", alignItems: "center", gap: "12px",
    maxWidth: "520px", padding: "10px 12px 10px 16px", background: "#202124", color: "#fff", borderRadius: "8px",
    font: "14px/1.4 'Google Sans', Roboto, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
  });
  for (const b of [setUp, close]) {
    Object.assign(b.style, { font: "inherit", fontWeight: "500", border: "0", borderRadius: "6px", padding: "6px 10px", minWidth: "36px", minHeight: "32px", cursor: "pointer", flexShrink: "0" });
  }
  Object.assign(setUp.style, { background: "#8ab4f8", color: "#202124" });
  Object.assign(close.style, { background: "transparent", color: "#bdc1c6" });
  pressable(setUp);
  pressable(close);
  return banner;
}
