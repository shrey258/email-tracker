const API = 'https://YOUR-SERVER.example';
const CLIENT_ID = document.querySelector('meta[name="google-client-id"]').content;
const params = new URLSearchParams(location.search);
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];

const $ = (selector) => document.querySelector(selector);

function el(tag, props = {}, ...children) {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

function fullDate(time) {
  return new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ago(time) {
  const seconds = (new Date(time) - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

function timeAgo(time) {
  return el('time', { dateTime: time, title: fullDate(time), textContent: ago(time) });
}

function note(title, line) {
  $('#status').hidden = false;
  $('#status').replaceChildren(el('strong', { textContent: title }), el('span', { textContent: line }));
}

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
    ...emails.map((email) => el('option', { value: email, textContent: email, selected: email === currentAccount() })),
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

function showEmails(email, mails) {
  if (!mails.length) return note('No emails tracked yet', `Send an email from Gmail as ${email} with the extension on and it shows up here.`);
  $('#status').hidden = true;
  const totals = [
    [mails.length, 'Sent'],
    [mails.filter((mail) => mail.opens.length).length, 'Opened'],
    [mails.filter((mail) => mail.clicks.length).length, 'Clicked'],
  ];
  $('.summary').replaceChildren(...totals.map(([count, label]) => el('div', {}, el('b', { textContent: count }), el('span', { textContent: label }))));
  $('.list').replaceChildren(...mails.map(row));
  $('.summary').hidden = $('.list').hidden = false;
}

function row(mail) {
  return el('details', {}, rowSummary(mail), timeline(mail));
}

function rowSummary(mail) {
  return el('summary', {},
    el('div', { className: 'main' },
      el('div', { className: mail.subject ? 'subject' : 'subject none', textContent: mail.subject || '(no subject)' }),
      el('div', { className: 'to', textContent: 'To ' + (mail.recipients.join(', ') || 'unknown recipients') })),
    openStatus(mail));
}

function openStatus(mail) {
  const opens = mail.opens.length;
  const label = opens ? `Opened${opens > 1 ? ` ${opens}×` : ''}` : 'Not opened';
  const when = opens ? [timeAgo(mail.opens.at(-1))] : ['sent ', timeAgo(mail.sent_at)];
  return el('div', { className: `status ${opens ? 'opened' : 'not-opened'}` },
    el('div', { className: 'state' }, el('span', { className: 'mark' }, opens ? '✓✓' : '✓'), label),
    el('div', { className: 'when' }, ...when));
}

function timeline(mail) {
  const events = [
    { kind: 'sent', at: mail.sent_at, what: 'Sent' },
    ...mail.opens.map((at) => ({ kind: 'open', at, what: 'Opened' })),
    ...mail.clicks.map((click) => ({ kind: 'click', at: click.at, what: clickLabel(click.url) })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
  return el('ol', {}, ...sameMinuteMerged(events).map((event) =>
    el('li', { className: event.kind },
      el('span', { className: 'what' }, event.what, event.count > 1 ? ` ×${event.count}` : ''),
      el('time', { dateTime: event.at, textContent: fullDate(event.at) }))));
}

function sameMinuteMerged(events) {
  const rows = [];
  for (const event of events) {
    const last = rows.at(-1);
    const sameMinute = last && last.kind === event.kind && fullDate(last.at) === fullDate(event.at) && last.kind !== 'click';
    if (sameMinute) last.count++;
    else rows.push({ ...event, count: 1 });
  }
  return rows;
}

function clickLabel(url) {
  const link = el('a', { href: url, target: '_blank', rel: 'noopener', textContent: url.replace(/^https?:\/\//, '') });
  return el('span', {}, 'Clicked ', link);
}

if (window.google?.accounts) window.onGoogleLibraryLoad();
start();
