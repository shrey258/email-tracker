function sessions() {
  return JSON.parse(localStorage.getItem('sessions') ?? '{}');
}

function saveSession(email, session) {
  localStorage.setItem('sessions', JSON.stringify({ ...sessions(), [email]: session }));
  postMessage({ type: 'et-session', session }, location.origin);
}

function removeSession(email) {
  const all = sessions();
  delete all[email];
  localStorage.setItem('sessions', JSON.stringify(all));
}

function currentAccount() {
  const all = sessions();
  const saved = localStorage.getItem('current');
  return saved in all ? saved : Object.keys(all)[0];
}

function emailOf(credential) {
  return JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email;
}
