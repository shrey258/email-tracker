const DASHBOARD = "https://YOUR-DASHBOARD.example";
document.getElementById("dashboard").href = DASHBOARD;
chrome.storage.local.get(null).then((all) => {
  const accounts = Object.keys(all).filter((k) => k.startsWith("session:")).map((k) => k.slice(8));
  document.getElementById("status").textContent = accounts.length
    ? `Tracking emails sent from: ${accounts.join(", ")}. Other accounts send untracked until you sign in as them on the dashboard.`
    : "Signed out. Emails are sent without tracking until you sign in on the dashboard as the account you send from.";
});
