const DASHBOARD = "https://YOUR-DASHBOARD.example";
document.getElementById("add-account").href = `${DASHBOARD}/?add=1`;

function accountsIn(all, prefix) {
  return Object.keys(all).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
}

function accountStatuses(all) {
  const signedIn = accountsIn(all, "session:");
  const others = [...new Set([...accountsIn(all, "seen:"), ...accountsIn(all, "disconnected:")])].filter((a) => !signedIn.includes(a));
  return [...signedIn, ...others].map((account) => ({
    account,
    signedIn: signedIn.includes(account),
    ready: signedIn.includes(account) && all[`gmailError:${account}`] === "",
    disconnected: `disconnected:${account}` in all,
  }));
}

async function render() {
  const statuses = accountStatuses(await chrome.storage.local.get(null));
  const wanted = statuses.filter((s) => !s.disconnected);
  document.getElementById("summary").textContent = summary(wanted.map((s) => s.account), wanted.filter((s) => s.ready).map((s) => s.account));

  const list = document.getElementById("accounts");
  if (!statuses.length) {
    list.replaceChildren(Object.assign(document.createElement("li"), { className: "empty", textContent: "Open Gmail, or add an account below." }));
    return;
  }
  list.replaceChildren(...statuses.map(row));
}

function summary(accounts, readyAccounts) {
  if (!readyAccounts.length) return "Emails aren't tracked yet. Set up the Gmail accounts you send from.";
  if (readyAccounts.length < accounts.length) return `${readyAccounts.length} of ${accounts.length} accounts ready.`;
  return `All set. Emails you send from ${readyAccounts.join(", ")} are tracked.`;
}

function row({ account, signedIn, ready, disconnected }) {
  const li = document.createElement("li");
  const name = Object.assign(document.createElement("span"), { className: "account", textContent: account });
  const right = Object.assign(document.createElement("span"), { className: "right" });
  if (ready) right.append(state("✓ Ready", "state ready"), disconnectButton(account));
  else if (signedIn) right.append(state("Signed in", "state"), connectButton(account), disconnectButton(account));
  else right.append(state(disconnected ? "Disconnected" : "Not set up", "state"), signInLink(account));
  li.append(name, right);
  return li;
}

function state(text, className) {
  return Object.assign(document.createElement("span"), { className, textContent: text });
}

function signInLink(account) {
  return Object.assign(document.createElement("a"), {
    className: "button", textContent: "Sign in", target: "_blank",
    href: `${DASHBOARD}/?hint=${encodeURIComponent(account)}`,
  });
}

function connectButton(account) {
  const button = Object.assign(document.createElement("button"), { textContent: "Connect Gmail" });
  button.onclick = async () => {
    button.textContent = "Waiting for Google…";
    const r = await chrome.runtime.sendMessage({ type: "connectGmail", account });
    if (!r.ok) Object.assign(button, { textContent: "Try again", title: r.error });
  };
  return button;
}

function disconnectButton(account) {
  const button = Object.assign(document.createElement("button"), { className: "quiet", textContent: "Disconnect" });
  button.title = `Stop tracking emails from ${account} in this browser and remove its Gmail permission.`;
  button.onclick = async () => {
    button.textContent = "Disconnecting…";
    await chrome.runtime.sendMessage({ type: "disconnect", account });
  };
  return button;
}

chrome.storage.onChanged.addListener(render);
render();
