const send = (session) => session && chrome.runtime.sendMessage({ type: "session", session });
send(localStorage.getItem("session"));
window.addEventListener("message", (e) => {
  if (e.source === window && e.origin === location.origin && e.data?.type === "et-session") send(e.data.session);
});
