async function apiGetWorkspace() {
  const res = await fetch("/api/workspace");
  if (!res.ok) throw new Error("Could not load workspace");
  return res.json();
}

async function apiSaveWorkspace(workspace) {
  const res = await fetch("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workspace),
  });
  if (!res.ok) throw new Error("Could not save workspace");
}

async function apiSend(payload) {
  const res = await fetch("/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Send failed");
  return res.json();
}
