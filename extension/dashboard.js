const send = (session, fromLoad) => session && chrome.runtime.sendMessage({ type: "session", session, fromLoad });

for (const session of Object.values(JSON.parse(localStorage.getItem("sessions") ?? "{}"))) send(session, true);

window.addEventListener("message", (e) => {
  if (e.source === window && e.origin === location.origin && e.data?.type === "et-session") send(e.data.session);
});
