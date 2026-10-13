const DAY = 86400000;
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];

function clock(time) {
  return new Date(time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function shortDate(time) {
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysAgo(time) {
  return Math.round((new Date().setHours(0, 0, 0, 0) - new Date(time).setHours(0, 0, 0, 0)) / DAY);
}

function dayLabel(time) {
  const days = daysAgo(time);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(time).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function ago(time) {
  const seconds = (new Date(time) - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

function lastSeen(time) {
  return Date.now() - new Date(time) < 7 * DAY ? ago(time) : `on ${shortDate(time)}`;
}
