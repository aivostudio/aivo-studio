/* =========================================================
   JOBS PANEL (FINAL) — RIGHT PANEL OWNER
   - Download: job_id + output_id (Archive Worker)
   - No legacy url download
   - Safari-safe
   ========================================================= */
(function () {
  "use strict";

  if (window.__aivoJobsPanelFinalBound) return;
  window.__aivoJobsPanelFinalBound = true;

  function $(sel) {
    return document.querySelector(sel);
  }

  function esc(s) {
    s = String(s == null ? "" : s);
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getJobs() {
    try {
      if (typeof window.__AIVO_JOBS_PERSIST_DEBUG__ === "function") {
        var d = window.__AIVO_JOBS_PERSIST_DEBUG__() || {};
        if (Array.isArray(d.ram) && d.ram.length) return d.ram;
        if (Array.isArray(d.ls) && d.ls.length) return d.ls;
      }
    } catch (_) {}

    try {
      var J = window.AIVO_JOBS;
      if (!J) return [];
      if (Array.isArray(J.list)) return J.list;
      if (typeof J.getAll === "function") return J.getAll() || [];
      if (typeof J.get === "function") return J.get() || [];
    } catch (_) {}

    return [];
  }

  function fmt(ts) {
    if (!ts) return "";
    try {
      var d = ts instanceof Date ? ts : new Date(ts);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return "";
    }
  }

  function pickJobId(j) {
    return j.job_id || j.jobId || j.id || "";
  }

  function pickOutputId(j) {
    return j.output_id || j.outputId || j.out_id || j.outId || "";
  }

  function render() {
    var panel = $("#studioRightPanel");
    if (!panel) return;

    panel.setAttribute("data-jobs-owner", "true");

    var jobs = getJobs();
    var html = ""
      + '<div class="card right-card">'
      + '  <div class="card-header">'
      + '    <div>'
      + '      <div class="card-title">Çıktılar</div>'
      + '      <div class="card-subtitle">Son işler</div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="right-list">';

    if (!jobs.length) {
      html += ""
        + '<div class="right-empty" style="display:flex;">'
        + '  <div class="right-empty-icon">✨</div>'
        + "</div>"
        + '<div class="card" style="margin-top:10px;">'
        + '  <div style="font-weight:700;">Henüz çıktı yok</div>'
        + "</div>";
    } else {
      html += '<div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">';

      for (var i = 0; i < Math.min(10, jobs.length); i++) {
        var j = jobs[i] || {};
        var title = j.title || j.name || j.type || "Çıktı";
        var kind = j.kind || j.media || "";
        var status = j.status || j.state || "done";
        var time = fmt(j.createdAt || j.ts || j.time);

        var jobId = pickJobId(j);
        var outId = pickOutputId(j);
        var canDl = jobId && outId;

        html += ""
          + '<div class="card" style="padding:12px;">'
          + '  <div style="display:flex; justify-content:space-between; gap:10px;">'
          + '    <div style="min-width:0;">'
          + '      <div style="font-weight:800;">' + esc(title) + "</div>"
          + '      <div style="opacity:.75; font-size:12px;">'
          + esc(kind) + " • " + esc(status) + (time ? " • " + esc(time) : "")
          + "</div>"
          + "    </div>"
          + '    <div style="display:flex; gap:6px;">'
          + '      <button type="button" class="chip-btn btn-download"'
          + ' data-action="download"'
          + ' data-job-id="' + esc(jobId) + '"'
          + ' data-output-id="' + esc(outId) + '"'
          + (canDl ? "" : " disabled")
          + ">İndir</button>"
          + "    </div>"
          + "  </div>"
          + "</div>";
      }

      html += "</div>";
    }

    html += "</div></div>";
    panel.innerHTML = html;
  }

  window.AIVO_JOBS_PANEL = window.AIVO_JOBS_PANEL || {};
  window.AIVO_JOBS_PANEL.render = render;
  window.AIVO_JOBS_PANEL.open = function () {
    var p = $("#studioRightPanel");
    if (!p) return;
    p.classList.add("is-jobs-open");
    render();
  };

  function boot() {
    var t = 0;
    var i = setInterval(function () {
      t++;
      render();
      if (t > 30) clearInterval(i);
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  try {
    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.subscribe === "function") {
      window.AIVO_JOBS.subscribe(render);
    }
  } catch (_) {}
})();
