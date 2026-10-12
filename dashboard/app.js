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

function onLogin({ credential }) {
  const email = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email;
  load(credential, email);
}

function signOut() {
  localStorage.removeItem('session');
  localStorage.removeItem('email');
  location.reload();
}

async function load(token, email) {
  $('.g_id_signin').hidden = true;
  note('Loading…', 'Fetching your emails.');
  const res = await fetch(API + '/stats', { headers: { Authorization: 'Bearer ' + token } }).catch(() => null);
  if (!res || !res.ok) {
    if (res?.status === 401 && token === localStorage.getItem('session')) {
      localStorage.removeItem('session');
      $('.g_id_signin').hidden = false;
      note('Signed out', 'Your session expired. Sign in again.');
    } else if (res?.status === 401) {
      $('.g_id_signin').hidden = false;
      note('This account isn’t allowed', 'Only accounts listed in the server’s OWNER_EMAIL can sign in.');
    } else note('Couldn’t reach the server', 'It may be waking up. Reload in a few seconds.');
    return;
  }
  const session = res.headers.get('X-Session');
  if (session) {
    localStorage.setItem('session', session);
    localStorage.setItem('email', email);
    postMessage({ type: 'et-session', session }, location.origin);
  }
  const mails = await res.json();
  $('.who').hidden = false;
  $('.who span').textContent = email;

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

if (localStorage.getItem('session')) load(localStorage.getItem('session'), localStorage.getItem('email'));
