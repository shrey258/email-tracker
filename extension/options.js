const DASHBOARD = "https://YOUR-DASHBOARD.example";
document.getElementById("dashboard").href = DASHBOARD;

// One row per signed-in account, with a button to let the extension fix your own Sent copies.
chrome.storage.local.get(null).then((all) => {
  const accounts = Object.keys(all).filter((k) => k.startsWith("session:")).map((k) => k.slice(8));
  document.getElementById("status").textContent = accounts.length
    ? "Tracking emails sent from these accounts. Connect Gmail for each, so your own views of sent emails don't count."
    : "Signed out. Emails are sent without tracking until you sign in on the dashboard as the account you send from.";
  for (const account of accounts) document.getElementById("accounts").append(row(account));
});

function row(account) {
  const result = document.createElement("span");
  const button = Object.assign(document.createElement("button"), { textContent: "Connect Gmail" });
  button.onclick = async () => {
    result.textContent = " Waiting for Google…";
    const r = await chrome.runtime.sendMessage({ type: "connectGmail", account });
    result.textContent = r.ok ? " Connected." : ` ${r.error}`;
  };
  const li = document.createElement("li");
  li.append(`${account} `, button, result);
  return li;
}
