function lastActivity(mail) {
  return Math.max(Date.parse(mail.sent_at), ...mail.opens.map(Date.parse), ...mail.clicks.map((click) => Date.parse(click.at)));
}

function nameOf(email) {
  const local = email.split('@')[0].split(/[._+]/)[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function people(recipients) {
  if (!recipients.length) return 'unknown recipients';
  if (recipients.length === 1) return recipients[0];
  const named = recipients.slice(0, 2).map(nameOf).join(', ');
  return recipients.length > 2 ? `${named} +${recipients.length - 2}` : named;
}

function linkText(url) {
  return url.replace(/^https?:\/\/(www\.)?/, '');
}

function siteOf(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}

function summaryLine(mail) {
  const to = `To ${people(mail.recipients)} · `;
  if (!mail.opens.length) return [to + 'not read yet'];
  const reads = mail.opens.length === 1 ? 'Read once' : `Read ${mail.opens.length} times`;
  const parts = [to, el('span', { className: 'read', textContent: reads }), `, last ${lastSeen(mail.opens.at(-1))}`];
  if (mail.clicks.length) parts.push(' · ', el('span', { className: 'clicked', textContent: `clicked ${siteOf(mail.clicks.at(-1).url)}` }));
  return parts;
}

function nearDay(time) {
  return daysAgo(time) < 2 ? dayLabel(time) : shortDate(time);
}

function when(time) {
  return `${nearDay(time)}, ${clock(time)}`;
}

function openEntry(time) {
  return { at: time, kind: 'open', what: ['Read'], when: when(time) };
}

function clickEntry(click) {
  const link = el('a', { href: click.url, target: '_blank', rel: 'noopener', textContent: linkText(click.url) });
  return { at: click.at, kind: 'click', what: ['Clicked ', link], when: when(click.at) };
}

function mailHistory(mail) {
  const entries = [
    { at: mail.sent_at, kind: 'sent', what: ['Sent'], when: when(mail.sent_at) },
    ...mail.clicks.map(clickEntry),
    ...mail.opens.map(openEntry),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return el('ol', { className: 'history' }, ...entries.map((entry) =>
    el('li', { className: entry.kind }, el('span', {}, ...entry.what), el('time', { dateTime: entry.at, textContent: entry.when }))));
}

function ticks(mail) {
  const read = mail.opens.length > 0;
  return el('span', { className: read ? 'ticks read' : 'ticks', textContent: read ? '✓✓' : '✓', ariaHidden: 'true' });
}
