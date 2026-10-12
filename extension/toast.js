// A small message at the bottom-left of Gmail, gone after 6 seconds.
function toast(text) {
  const t = Object.assign(document.createElement("div"), { textContent: text });
  Object.assign(t.style, {
    position: "fixed", bottom: "24px", left: "24px", zIndex: 99999, padding: "10px 14px",
    background: "#202124", color: "#fff", borderRadius: "6px", font: "14px sans-serif",
  });
  document.body.append(t);
  setTimeout(() => t.remove(), 6000);
}
