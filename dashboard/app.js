const API = 'https://YOUR-SERVER.example';
const CLIENT_ID = document.querySelector('meta[name="google-client-id"]').content;
const params = new URLSearchParams(location.search);

function note(title, line, ...actions) {
  $('#status').hidden = false;
  $('#status').replaceChildren(el('strong', { textContent: title }), el('span', { textContent: line }), ...actions);
}

function unreachable(email) {
  const retry = el('button', { type: 'button', className: 'retry', textContent: 'Try again' });
  retry.onclick = () => load(email);
  note('Couldn’t reach the server', 'It may be waking up. This takes a few seconds.', retry);
}

function clearEmails() {
  $('.mails').hidden = true;
}

function showSignIn(title, line) {
  clearEmails();
  note(title, line);
  $('#google-button').hidden = false;
}

function renderAccounts() {
  const emails = Object.keys(sessions());
  $('.accounts').hidden = !emails.length;
  $('#account').replaceChildren(
    ...emails.map((email) => el('option', { value: email, textContent: email, selected: email === currentAccount() })),
    el('option', { value: 'add', textContent: 'Add account…' }));
}

window.onGoogleLibraryLoad = () => {
  google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onLogin, login_hint: params.get('hint') ?? '', use_fedcm_for_button: false, ux_mode: 'popup' });
  google.accounts.id.renderButton($('#google-button'), { size: 'large', shape: 'pill', text: 'signin_with', theme: 'filled_black' });
};

function fetchStats(token) {
  return fetch(API + '/stats', { headers: { Authorization: 'Bearer ' + token } }).catch(() => null);
}

function onLogin({ credential }) {
  load(emailOf(credential), credential);
}

async function load(email, token = sessions()[email]) {
  clearEmails();
  $('#google-button').hidden = true;
  note('Loading…', `Fetching emails sent from ${email}.`);
  const res = await fetchStats(token);
  if (!res) return unreachable(email);
  if (res.status === 401 && token === sessions()[email]) {
    removeSession(email);
    renderAccounts();
    return showSignIn('Signed out', `The session for ${email} expired. Sign in again.`);
  }
  if (res.status === 401) return showSignIn('This account isn’t allowed', `Only accounts listed in the server’s OWNER_EMAIL can sign in, and ${email} isn’t one.`);
  if (!res.ok) return unreachable(email);

  const session = res.headers.get('X-Session');
  if (session) saveSession(email, session);
  localStorage.setItem('current', email);
  renderAccounts();
  showEmails(email, await res.json());
}

async function refresh() {
  const email = currentAccount();
  if (document.hidden || !email || $('.mails').hidden) return;
  const res = await fetchStats(sessions()[email]);
  if (res?.ok && email === currentAccount()) showEmails(email, await res.json());
}

document.addEventListener('visibilitychange', refresh);
setInterval(refresh, 60000);

function start() {
  renderAccounts();
  const hint = params.get('hint');
  const account = currentAccount();
  if (hint && hint in sessions()) return load(hint);
  if (hint) return showSignIn(`Sign in as ${hint}`, 'So Email Tracker can track the emails you send from it.');
  if (params.has('add')) return showSignIn('Add an account', 'Sign in with another Gmail account you send from.');
  if (account) return load(account);
  showSignIn('Sign in to see your emails', 'Sign in with the Gmail account you send from. You can add more accounts after.');
}

$('#account').onchange = (event) => {
  if (event.target.value === 'add') {
    renderAccounts();
    return showSignIn('Add an account', 'Sign in with another Gmail account you send from.');
  }
  load(event.target.value);
};

$('#sign-out').onclick = () => {
  removeSession(currentAccount());
  localStorage.removeItem('current');
  start();
};

if (window.google?.accounts) window.onGoogleLibraryLoad();
start();
