const API = 'https://YOUR-SERVER.example';
const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const full = t => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function ago(t) {
  const s = (new Date(t) - Date.now()) / 1000;
  for (const [unit, n] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]])
    if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit);
  return 'just now';
}
const time = t => el('time', { dateTime: t, title: full(t), textContent: ago(t) });

function note(title, line) {
  $('#status').hidden = false;
  $('#status').replaceChildren(el('strong', { textContent: title }), el('span', { textContent: line }));
}

const CLIENT_ID = document.querySelector('meta[name="google-client-id"]').content;
const params = new URLSearchParams(location.search);

function sessions() {
  return JSON.parse(localStorage.getItem('sessions') ?? '{}');
}

function saveSession(email, session) {
  localStorage.setItem('sessions', JSON.stringify({ ...sessions(), [email]: session }));
  postMessage({ type: 'et-session', session }, location.origin);
}

function removeSession(email) {
  const all = sessions();
  delete all[email];
  localStorage.setItem('sessions', JSON.stringify(all));
}

function currentAccount() {
  const all = sessions();
  const saved = localStorage.getItem('current');
  return saved in all ? saved : Object.keys(all)[0];
}

function moveOldSession() {
  const session = localStorage.getItem('session'), email = localStorage.getItem('email');
  if (session && email) saveSession(email, session);
  localStorage.removeItem('session');
  localStorage.removeItem('email');
}

function emailOf(credential) {
  return JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email;
}

function clearEmails() {
  $('.summary').hidden = $('.list').hidden = true;
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
    ...emails.map(e => el('option', { value: e, textContent: e, selected: e === currentAccount() })),
    el('option', { value: 'add', textContent: 'Add account…' }));
}

window.onGoogleLibraryLoad = () => {
  google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onLogin, login_hint: params.get('hint') ?? '', use_fedcm_for_button: false, ux_mode: 'popup' });
  google.accounts.id.renderButton($('#google-button'), { size: 'large', shape: 'pill', text: 'signin_with', theme: 'filled_black' });
};

function onLogin({ credential }) {
  load(emailOf(credential), credential);
}

async function load(email, token = sessions()[email]) {
  clearEmails();
  $('#google-button').hidden = true;
  note('Loading…', `Fetching emails sent from ${email}.`);
  const res = await fetch(API + '/stats', { headers: { Authorization: 'Bearer ' + token } }).catch(() => null);
  if (!res) return note('Couldn’t reach the server', 'It may be waking up. Reload in a few seconds.');
  if (res.status === 401 && token === sessions()[email]) {
    removeSession(email);
    renderAccounts();
    return showSignIn('Signed out', `The session for ${email} expired. Sign in again.`);
  }
  if (res.status === 401) return showSignIn('This account isn’t allowed', `Only accounts listed in the server’s OWNER_EMAIL can sign in, and ${email} isn’t one.`);
  if (!res.ok) return note('Couldn’t reach the server', 'It may be waking up. Reload in a few seconds.');

  const session = res.headers.get('X-Session');
  if (session) saveSession(email, session);
  localStorage.setItem('current', email);
  renderAccounts();
  showEmails(email, await res.json());
}

function start() {
  moveOldSession();
  renderAccounts();
  const hint = params.get('hint');
  const account = currentAccount();
  if (hint && hint in sessions()) return load(hint);
  if (hint) return showSignIn(`Sign in as ${hint}`, 'So Email Tracker can track the emails you send from it.');
  if (params.has('add')) return showSignIn('Add an account', 'Sign in with another Gmail account you send from.');
  if (account) return load(account);
  showSignIn('Sign in to see your emails', 'Sign in with the Gmail account you send from. You can add more accounts after.');
}

$('#account').onchange = (e) => {
  if (e.target.value === 'add') {
    renderAccounts();
    return showSignIn('Add an account', 'Sign in with another Gmail account you send from.');
  }
  load(e.target.value);
};

$('#sign-out').onclick = () => {
  removeSession(currentAccount());
  localStorage.removeItem('current');
  start();
};

function showEmails(email, mails) {
  if (!mails.length) return note('No emails tracked yet', `Send an email from Gmail as ${email} with the extension on and it shows up here.`);
  $('#status').hidden = true;
  const opened = mails.filter(m => m.opens.length).length;
  const clicked = mails.filter(m => m.clicks.length).length;
  $('.summary').replaceChildren(...[[mails.length, 'Sent'], [opened, 'Opened'], [clicked, 'Clicked']]
    .map(([n, label]) => el('div', {}, el('b', { textContent: n }), el('span', { textContent: label }))));
  $('.list').replaceChildren(...mails.map(row));
  $('.summary').hidden = $('.list').hidden = false;
}

function row(m) {
  const n = m.opens.length;
  const state = n ? `Opened${n > 1 ? ` ${n}×` : ''}` : 'Not opened';
  const status = el('div', { className: `status ${n ? 'opened' : 'not-opened'}` },
    el('div', { className: 'state' }, el('span', { className: 'dot' }), state),
    el('div', { className: 'when' }, ...(n ? [time(m.opens[n - 1])] : ['sent ', time(m.sent_at)])));
  const head = el('summary', {},
    el('div', { className: 'main' },
      el('div', { className: m.subject ? 'subject' : 'subject none', textContent: m.subject || '(no subject)' }),
      el('div', { className: 'to', textContent: 'To ' + (m.recipients.join(', ') || 'unknown recipients') })),
    status);

  const events = [
    { cls: 'sent', at: m.sent_at, what: 'Sent' },
    ...m.opens.map(at => ({ cls: 'open', at, what: 'Opened' })),
    ...m.clicks.map(c => ({ cls: 'click', at: c.at, what: el('span', {}, 'Clicked ', el('a', { href: c.url, target: '_blank', rel: 'noopener', textContent: c.url.replace(/^https?:\/\//, '') })) })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
  const timeline = el('ol', {}, ...events.map(e =>
    el('li', { className: e.cls }, el('span', { className: 'what' }, e.what), el('time', { dateTime: e.at, textContent: full(e.at) }))));
  return el('details', {}, head, timeline);
}

if (window.google?.accounts) window.onGoogleLibraryLoad();
start();
