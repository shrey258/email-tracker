function toast(text) {
  const t = Object.assign(document.createElement("div"), { textContent: text });
  Object.assign(t.style, {
    position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", zIndex: 99999,
    maxWidth: "520px", padding: "10px 16px", background: "#202124", color: "#fff", borderRadius: "8px",
    font: "14px/1.4 'Google Sans', Roboto, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
  });
  document.body.append(t);
  slideIn(t);
  const words = text.split(/\s+/).length;
  setTimeout(() => slideOut(t), Math.max(4000, words * 300));
}
