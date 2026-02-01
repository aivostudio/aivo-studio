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

    // ✅ AIVO_JOBS = store object (upsert var). O yüzden SADECE bilinen alanları oku.
    function getJobsArray() {
      const s = window.AIVO_JOBS;

      // array ise direkt
      if (Array.isArray(s)) return s;
      if (!s) return [];

      // store içindeki olası list alanları
      if (Array.isArray(s.list)) return s.list;
      if (Array.isArray(s.items)) return s.items;
      if (Array.isArray(s.jobs)) return s.jobs;

      // bazı store'lar state'i nested tutar: s.state.jobs gibi
      if (s.state) {
        if (Array.isArray(s.state.list)) return s.state.list;
        if (Array.isArray(s.state.items)) return s.state.items;
        if (Array.isArray(s.state.jobs)) return s.state.jobs;
      }

      // başka bir şekil bilmiyorsak boş dön (PATLAMASIN)
      return [];
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

    async function poll() {
      if (destroyed) return;

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
