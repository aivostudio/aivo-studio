import { createJob } from "./studio.jobs.js";

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-generate]");
  if (!btn) return;

  createJob(btn.dataset.generate);
});
