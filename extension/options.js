const input = document.getElementById("key");
const status = document.getElementById("status");

chrome.storage.local.get("hmacKey").then(({ hmacKey }) => {
  status.textContent = hmacKey ? "Key is set." : "No key yet.";
});

document.getElementById("save").addEventListener("click", async () => {
  const hmacKey = input.value.trim();
  if (!hmacKey) return;
  await chrome.storage.local.set({ hmacKey });
  input.value = "";
  status.textContent = "Saved.";
});
