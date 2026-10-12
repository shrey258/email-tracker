const DASHBOARD = "https://YOUR-DASHBOARD.example";
document.getElementById("add-account").href = `${DASHBOARD}/?add=1`;

function accountsIn(all, prefix) {
  return Object.keys(all).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
}

async function render() {
  const all = await chrome.storage.local.get(null);
  const signedIn = accountsIn(all, "session:");
  const seen = [...new Set([...accountsIn(all, "seen:"), ...accountsIn(all, "disconnected:")])].filter((a) => !signedIn.includes(a));
  const disconnected = (account) => `disconnected:${account}` in all;
  const ready = (account) => signedIn.includes(account) && all[`gmailError:${account}`] === "";
  const accounts = [...signedIn, ...seen];

  const wanted = accounts.filter((a) => !disconnected(a));
  document.getElementById("summary").textContent = summary(wanted, wanted.filter(ready));
  const list = document.getElementById("accounts");
  if (!accounts.length) {
    list.replaceChildren(Object.assign(document.createElement("li"), { className: "empty", textContent: "Open Gmail, or add an account below." }));
    return;
  }
  list.replaceChildren(...accounts.map((account) => row(account, signedIn.includes(account), ready(account), disconnected(account))));
}

function summary(accounts, readyAccounts) {
  if (!readyAccounts.length) return "Emails aren't tracked yet. Set up the Gmail accounts you send from.";
  if (readyAccounts.length < accounts.length) return `${readyAccounts.length} of ${accounts.length} accounts ready.`;
  return `All set. Emails you send from ${readyAccounts.join(", ")} are tracked.`;
}

function row(account, isSignedIn, isReady, isDisconnected) {
  const li = document.createElement("li");
  const name = Object.assign(document.createElement("span"), { className: "account", textContent: account });
  const right = Object.assign(document.createElement("span"), { className: "right" });
  if (isReady) right.append(state("✓ Ready", "state ready"), disconnectButton(account));
  else if (isSignedIn) right.append(state("Signed in", "state"), connectButton(account), disconnectButton(account));
  else right.append(state(isDisconnected ? "Disconnected" : "Not set up", "state"), signInLink(account));
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
