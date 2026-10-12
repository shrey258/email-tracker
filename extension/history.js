const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

let sharedPanel;

function historyPanel() {
  if (sharedPanel?.isConnected) return sharedPanel;
  sharedPanel = document.createElement("div");
  Object.assign(sharedPanel.style, {
    position: "fixed", zIndex: 99999, opacity: "0", transform: "scale(0.97)", transformOrigin: "top left",
    transition: reducedMotion() ? "none" : `opacity 150ms ${EASE_OUT}, transform 150ms ${EASE_OUT}`,
    minWidth: "220px", maxHeight: "300px", overflowY: "auto", padding: "10px 14px",
    background: "#202124", color: "#e8eaed", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
    font: "13px/1.6 'Google Sans', Roboto, sans-serif",
    pointerEvents: "none", webkitFontSmoothing: "antialiased",
  });
  document.body.append(sharedPanel);
  return sharedPanel;
}

function historySections(opens, clicks) {
  const sections = [];
  if (opens.length) sections.push(section(`Opens · ${opens.length}`, opens.map((at) => ({ at }))));
  if (clicks.length) sections.push(section(`Clicks · ${clicks.length}`, clicks.map((c) => ({ at: c.at, note: linkName(c.url) }))));
  return sections;
}

function section(title, events) {
  const wrap = document.createElement("div");
  const heading = Object.assign(document.createElement("div"), { textContent: title });
  Object.assign(heading.style, { color: "#9aa0a6", fontSize: "12px", margin: "4px 0 2px" });
  const grid = document.createElement("div");
  Object.assign(grid.style, { display: "grid", gridTemplateColumns: "auto auto 1fr", columnGap: "16px" });
  let lastDay = "";
  for (const { day, time, note, count } of sameMinuteMerged(events)) {
    grid.append(
      cell(day === lastDay ? "" : day, { color: "#9aa0a6" }),
      cell(count > 1 ? `${time} ×${count}` : time, { fontVariantNumeric: "tabular-nums" }),
      cell(note ?? "", { color: "#8ab4f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
    );
    lastDay = day;
  }
  wrap.append(heading, grid);
  return wrap;
}

function sameMinuteMerged(events) {
  const rows = [];
  for (const { at, note } of [...events].sort((a, b) => new Date(b.at) - new Date(a.at))) {
    const day = dayFormat.format(new Date(at));
    const time = timeFormat.format(new Date(at));
    const last = rows.at(-1);
    if (last && last.day === day && last.time === time && last.note === note) last.count++;
    else rows.push({ day, time, note, count: 1 });
  }
  return rows;
}

function cell(text, style) {
  const div = Object.assign(document.createElement("div"), { textContent: text });
  Object.assign(div.style, style);
  return div;
}

function linkName(url) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function attachHistory(line, opens, clicks) {
  if (!opens.length && !clicks.length) return;
  Object.assign(line.style, { display: "inline-block", cursor: "default" });
  line.addEventListener("mouseenter", () => {
    const panel = historyPanel();
    const box = line.getBoundingClientRect();
    panel.replaceChildren(...historySections(opens, clicks));
    Object.assign(panel.style, { top: `${box.bottom + 6}px`, left: `${box.left}px`, opacity: "1", transform: "scale(1)" });
  });
  line.addEventListener("mouseleave", () => Object.assign(historyPanel().style, { opacity: "0", transform: "scale(0.97)" }));
}
