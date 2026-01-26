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

