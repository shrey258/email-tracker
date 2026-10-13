const VIEWS = [
  ['all', 'Sent', () => true],
  ['read', 'Read', (mail) => mail.opens.length > 0],
  ['unread', 'Unread', (mail) => mail.opens.length === 0],
  ['clicked', 'Clicked', (mail) => mail.clicks.length > 0],
];
const RANGES = {
  all: () => true,
  today: (mail) => daysAgo(mail.sent_at) === 0,
  week: (mail) => Date.now() - Date.parse(mail.sent_at) < 7 * DAY,
  month: (mail) => Date.now() - Date.parse(mail.sent_at) < 30 * DAY,
};
const SORTS = {
  activity: lastActivity,
  sent: (mail) => Date.parse(mail.sent_at),
  reads: (mail) => mail.opens.length,
};
const filters = { view: 'all', range: 'all', sort: 'activity', query: '' };
const expanded = new Set();
let allMails = [];

function showEmails(email, mails) {
  allMails = mails;
  if (!mails.length) {
    $('.mails').hidden = true;
    return note('No emails tracked yet', `Send an email from Gmail as ${email} with the extension on and it shows up here.`);
  }
  $('#status').hidden = true;
  $('.mails').hidden = false;
  render();
}

function matchesQuery(mail) {
  const query = filters.query.trim().toLowerCase();
  return !query || `${mail.subject} ${mail.recipients.join(' ')}`.toLowerCase().includes(query);
}

function render() {
  const candidates = allMails.filter((mail) => RANGES[filters.range](mail) && matchesQuery(mail));
  const inView = VIEWS.find(([key]) => key === filters.view)[2];
  const shown = candidates.filter(inView).sort((a, b) => SORTS[filters.sort](b) - SORTS[filters.sort](a));
  renderTabs(candidates);
  $('#clear').hidden = filters.view === 'all' && filters.range === 'all' && !filters.query;
  $('.list').replaceChildren(...(shown.length ? listItems(shown) : [nothingFound()]));
}

function renderTabs(candidates) {
  $('.tabs').replaceChildren(...VIEWS.map(([key, label, test]) => {
    const tab = el('button', { type: 'button', className: 'tab', ariaPressed: String(filters.view === key) },
      el('b', { textContent: candidates.filter(test).length }), label);
    tab.onclick = () => {
      filters.view = key;
      render();
      $('.tab[aria-pressed="true"]').focus();
    };
    return tab;
  }));
}

function sortTime(mail) {
  return filters.sort === 'sent' ? mail.sent_at : lastActivity(mail);
}

function listItems(shown) {
  if (filters.sort === 'reads') return shown.map(mailItem);
  const items = [];
  let lastLabel = '';
  for (const mail of shown) {
    const label = dayLabel(sortTime(mail));
    if (label !== lastLabel) items.push(el('h2', { className: 'day', textContent: label }));
    lastLabel = label;
    items.push(mailItem(mail));
  }
  return items;
}

function mailItem(mail) {
  const open = expanded.has(mail.id);
  const time = filters.sort === 'reads' ? shortDate(sortTime(mail)) : clock(sortTime(mail));
  const row = el('button', { type: 'button', className: 'row', ariaExpanded: String(open) },
    ticks(mail),
    el('span', { className: mail.subject ? 'subject' : 'subject none', textContent: mail.subject || '(no subject)' }),
    el('span', { className: 'time', textContent: time }),
    el('span', { className: 'line' }, ...summaryLine(mail)));
  const item = el('div', { className: 'mail' }, row, ...(open ? [mailHistory(mail)] : []));
  row.onclick = () => toggle(mail, item);
  return item;
}

function toggle(mail, item) {
  if (expanded.has(mail.id)) expanded.delete(mail.id);
  else expanded.add(mail.id);
  const next = mailItem(mail);
  item.replaceWith(next);
  next.firstChild.focus();
}

function nothingFound() {
  const query = filters.query.trim();
  return el('div', { className: 'nothing' },
    el('p', { textContent: query ? `Nothing matches “${query}”.` : 'Nothing here.' }),
    'Try another tab or a longer time range.');
}

$('#search').oninput = (event) => {
  filters.query = event.target.value;
  render();
};

$('#range').onchange = (event) => {
  filters.range = event.target.value;
  render();
};

$('#sort').onchange = (event) => {
  filters.sort = event.target.value;
  render();
};

$('#clear').onclick = () => {
  Object.assign(filters, { view: 'all', range: 'all', query: '' });
  $('#search').value = '';
  $('#range').value = 'all';
  render();
};
