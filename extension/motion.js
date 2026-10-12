const EASE_OUT = "cubic-bezier(0.32, 0.72, 0, 1)";
const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";

function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function slideIn(element) {
  if (reducedMotion()) return;
  element.animate(
    [{ opacity: 0, transform: `${element.style.transform} translateY(-8px)` }, { opacity: 1, transform: element.style.transform }],
    { duration: 200, easing: EASE_OUT },
  );
}

function slideOut(element) {
  if (reducedMotion()) return element.remove();
  const leaving = element.animate(
    [{ opacity: 1, transform: element.style.transform }, { opacity: 0, transform: `${element.style.transform} translateY(-8px)` }],
    { duration: 150, easing: EASE_IN, fill: "forwards" },
  );
  leaving.onfinish = () => element.remove();
}

function pressable(button) {
  if (reducedMotion()) return;
  button.style.transition = `transform 150ms ${EASE_OUT}`;
  button.addEventListener("pointerdown", () => (button.style.transform = "scale(0.96)"));
  for (const type of ["pointerup", "pointerleave"]) button.addEventListener(type, () => (button.style.transform = ""));
}
