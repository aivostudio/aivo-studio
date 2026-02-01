(function () {
  if (!window.RightPanel) return;

  window.RightPanel.register("audio", function (host, ctx) {
    // DOM
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

    // ✅ AIVO_JOBS normalizer (array değilse patlamasın)
    function getJobsArray() {
      const j = window.AIVO_JOBS;

      if (Array.isArray(j)) return j;
      if (!j) return [];

      // olası store şekilleri
      if (Array.isArray(j.list)) return j.list;
      if (Array.isArray(j.items)) return j.items;
      if (Array.isArray(j.jobs)) return j.jobs;

      // object/map ise values
      if (typeof j === "object") return Object.values(j).filter(Boolean);

      return [];
    }

    function render(items) {
      list.innerHTML =
        items
          .map(
            (it) => `
        <div data-id="${escapeHtml(it.job_id)}" data-src="${escapeHtml(it.src || "")}"
             style="padding:8px; border:1px solid rgba(255,255,255,.12); border-radius:10px; cursor:pointer;">
          <div style="font-weight:600; font-size:13px;">${escapeHtml(it.title || "Untitled")}</div>
          <div style="opacity:.7; font-size:12px;">${escapeHtml(it.state || "—")}</div>
        </div>
      `
          )
          .join("") || `<div style="opacity:.7; font-size:13px;">Henüz job yok.</div>`;
    }

    function escapeHtml(s) {
      return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    async function poll() {
      if (destroyed) return;

      // ✅ Burada sadece audio job'larını al (array garantili)
      const jobs = getJobsArray()
        .filter((j) => (j?.kind || j?.type) === "audio")
        .slice(0, 20);

      const out = [];
      for (const j of jobs) {
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

    // ✅ click: src varsa çal
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

    // >>> destroy <<<
    return function destroy() {
      destroyed = true;
      if (timer) clearInterval(timer);
      host.removeEventListener("click", onClick);
    };
  });
})();
