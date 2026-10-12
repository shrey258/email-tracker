const BLUE = "#1a73e8";
const GREY = "#5f6368";

function checkMark(opened) {
  const mark = document.createElement("span");
  mark.textContent = opened ? "✓✓" : "✓";
  mark.dataset.etMark = "1";
  Object.assign(mark.style, {
    color: opened ? BLUE : GREY, fontWeight: "700", letterSpacing: "-3px", marginRight: "8px",
    display: "inline-block", minWidth: "16px",
  });
  return mark;
}
