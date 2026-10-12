const CLIENT_ID = "YOUR-GOOGLE-CLIENT-ID";
const SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const tokens = {};

export async function gmailToken(account, interactive = false) {
  if (Date.now() < tokens[account]?.until) return tokens[account].token;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "token",
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: SCOPE,
    login_hint: account,
    prompt: interactive ? "consent" : "none",
  });
  const back = new URLSearchParams(new URL(await chrome.identity.launchWebAuthFlow({ url: url.href, interactive })).hash.slice(1));
  const token = back.get("access_token");
  if (!token) throw new Error(`Gmail not connected for ${account} (${back.get("error") ?? "no token"})`);
  await checkAccount(token, account);
  tokens[account] = { token, until: Date.now() + (Number(back.get("expires_in")) - 60) * 1000 };
  return token;
}

async function checkAccount(token, account) {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${token}` } });
  const { emailAddress } = await res.json();
  if (emailAddress?.toLowerCase() !== account) throw new Error(`Google gave a token for ${emailAddress}, not ${account}`);
}
