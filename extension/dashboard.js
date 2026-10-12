const send = (session, fromLoad) => session && chrome.runtime.sendMessage({ type: "session", session, fromLoad });

for (const session of Object.values(JSON.parse(localStorage.getItem("sessions") ?? "{}"))) send(session, true);

window.addEventListener("message", (event) => {
  const fromThisPage = event.source === window && event.origin === location.origin;
  if (fromThisPage && event.data?.type === "et-session") send(event.data.session);
});
