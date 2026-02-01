(function () {
  if (!window.RightPanel) return;

  window.RightPanel.register("audio", function (host, ctx) {
    host.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <audio id="a" controls style="width:100%"></audio>
        <div id="list" style="display:flex; flex-direction:column; gap:6px;"></div>
      </div>
    `;

    const audio = host.querySelector("#a");
    const list = host.querySelector("#list");

    let timer = null;
    let destroyed = false;

    // ✅ PANEL İÇİ JOB LİSTESİ (tek gerçek kaynak)
    const localJobs = [];

    // ✅ AIVO_JOBS.upsert HOOK
    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.upsert === "function") {
      const originalUpsert = window.AIVO_JOBS.upsert;

      window.AIVO_JOBS.upsert = function (job) {
        try {
          if (job && (job.kind === "audio" || job.type === "audio")) {
            const idx = localJobs.findIndex(j => j.job_id === job.job_id);
            if (idx === -1) {
              localJobs.unshift(job);
            } else {
              localJobs[idx] = { ...localJobs[idx], ...job };
            }
          }
        } catch (_) {}

        return originalUpsert.apply(this, arguments);
      };
    }

    function escapeHtml(s) {
      return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function render(items) {
      list.innerHTML =
        items.map(it => `
          <div data-id="${escapeHtml(it.job_id)}" data-src="${escapeHtml(it.src || "")}"
               style="padding:8px; border:1px solid rgba(255,255,255,.12); border-radius:10px; cursor:pointer;">
            <div style="font-weight:600; font-size:13px;">${escapeHtml(it.title || "Untitled")}</div>
            <div style="opacity:.7; font-size:12px;">${escapeHtml(it.state || "—")}</div>
          </div>
        `).join("") || `<div style="opacity:.7;">Henüz job yok</div>`;
    }

    async function poll() {
      if (destroyed) return;

      const out = [];
      for (const j of localJobs.slice(0, 20)) {
        try {
          const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(j.job_id)}`, { cache: "no-store" });
          const json = r.ok ? await r.json() : null;

          out.push({
            job_id: j.job_id,
            title: j.title,
            state: json?.status || json?.state || "unknown",
            src: json?.output_url || json?.src || null,
          });
        } catch (e) {
          out.push({ job_id: j.job_id, title: j.title, state: "status_error", src: null });
        }
      }

      render(out);
    }

    function onClick(e) {
      const row = e.target.closest("[data-id]");
      if (!row) return;

      const src = row.getAttribute("data-src");
      if (!src) return;

      if (audio.src !== new URL(src, location.origin).href) {
        audio.src = src;
      }
      audio.play?.().catch(() => {});
    }

    host.addEventListener("click", onClick);

    timer = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, 2500);

    poll();

    return function destroy() {
      destroyed = true;
      if (timer) clearInterval(timer);
      host.removeEventListener("click", onClick);
    };
  });
})();
