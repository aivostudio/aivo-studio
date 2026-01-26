(function () {
  "use strict";

  // AIVO Archive Worker (PROD)
  var ARCHIVE_WORKER_BASE = "https://aivo-archive-worker.aivostudioapp.workers.dev";

  function toastError(msg) {
    if (window.toast && typeof window.toast.error === "function") {
      window.toast.error(msg);
    } else {
      alert(msg);
    }
  }

  async function handleDownload(btn) {
    var jobId = btn.getAttribute("data-job-id");
    var outputId = btn.getAttribute("data-output-id");
    var expiresIn = btn.getAttribute("data-expires") || "300";

    if (!jobId || !outputId) {
      return toastError("İndirme bilgisi eksik (job/output).");
    }

    btn.disabled = true;

    try {
      var api =
        ARCHIVE_WORKER_BASE +
        "/jobs/output/download-url" +
        "?job_id=" + encodeURIComponent(jobId) +
        "&output_id=" + encodeURIComponent(outputId) +
        "&expiresIn=" + encodeURIComponent(expiresIn);

      var res = await fetch(api);
      var data = await res.json();

      if (!res.ok || !data || data.ok !== true || !data.url) {
        return toastError("İndirme linki alınamadı.");
      }

      // 🔥 Download başlar
      window.location.href = data.url;

    } catch (e) {
      toastError("İndirme sırasında hata oluştu.");
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest(
      "[data-action='download'][data-job-id][data-output-id], .btn-download"
    );
    if (!btn) return;

    ev.preventDefault();
    handleDownload(btn);
  });
})();
// ===============================
// AIVO ARCHIVE — SAVE AFTER SUCCESS
// ===============================

const AIVO_ARCHIVE_TYPE = {
  music: "music",
  voice: "voice",
  video: "video",
  atmosphere: "atmosphere",
  cover: "cover",
  social: "social",
  hook: "hook"
};

async function archiveAfterSuccess({ moduleKey, userId, blob, filename }) {
  const type = AIVO_ARCHIVE_TYPE[moduleKey] || "unknown";

  // 1) job create
  const jobRes = await fetch(
    ARCHIVE_WORKER_BASE +
      "/jobs/create-test?user_id=" +
      encodeURIComponent(userId) +
      "&type=" +
      encodeURIComponent(type)
  ).then(r => r.json());

  const jobId = jobRes.job_id;

  // 2) output add
  const outRes = await fetch(
    ARCHIVE_WORKER_BASE +
      "/jobs/output/add-test?job_id=" +
      encodeURIComponent(jobId)
  ).then(r => r.json());

  const outputId = outRes.output_id;

  // 3) file put
  const putUrl =
    ARCHIVE_WORKER_BASE +
    "/files/put-test?job_id=" +
    encodeURIComponent(jobId) +
    "&output_id=" +
    encodeURIComponent(outputId) +
    "&name=" +
    encodeURIComponent(filename);

  await fetch(putUrl, {
    method: "POST",
    body: blob
  });

  return { jobId, outputId, type };
}

// global expose
window.AIVO_ARCHIVE_SAVE = archiveAfterSuccess;


