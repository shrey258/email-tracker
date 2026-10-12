async function addComposeStatus(ours) {
  const status = await chrome.runtime.sendMessage({ type: "setupStatus", account: account() }).catch(() => null);
  const tracked = status?.ok && status.signedIn;
  const chip = document.createElement("span");
  chip.dataset.etChip = "1";
  Object.assign(chip.style, {
    display: "inline-flex", alignItems: "center", gap: "4px", marginLeft: "12px", padding: "4px 10px",
    borderRadius: "999px", font: "500 13px/1.2 'Google Sans', Roboto, sans-serif", whiteSpace: "nowrap",
    alignSelf: "center",
  });
  if (tracked) {
    chip.append(checkMark(false), "Tracked");
    chip.title = "Email Tracker will show when this email is opened and its links are clicked.";
    Object.assign(chip.style, { color: GREEN, background: "rgba(24,128,56,0.1)" });
  } else {
    chip.textContent = "Not tracked · Set up";
    chip.title = `Email Tracker isn't set up for ${account()}. Click to set it up.`;
    Object.assign(chip.style, { color: "#b06000", background: "rgba(249,171,0,0.15)", cursor: "pointer" });
    chip.onclick = () => chrome.runtime.sendMessage({ type: "openSetup" });
  }
  ours.parentElement.after(chip);
}
