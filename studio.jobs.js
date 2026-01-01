export async function createJob(type, payload = {}) {
  return fetch("/api/jobs/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...payload })
  });
}
