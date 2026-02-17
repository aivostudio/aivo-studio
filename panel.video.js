// panel.video.js
(function(){
  function escapeHtml(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function fmtTime(ts){
    try{
      const d = new Date(ts);
      if(isNaN(+d)) return "";
      const pad = (n)=> String(n).padStart(2,"0");
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }catch(e){ return ""; }
  }

function pickBestVideoUrl(job){
  const outs = (job && job.outputs) || [];
  if(!Array.isArray(outs) || !outs.length) return "";

  // 1) direkt type=video araması
  const hit = outs.find(x => {
    if(!x) return false;
    const t = String(x.type || x.kind || "").toLowerCase();
    const mt = x.meta && x.meta.type ? String(x.meta.type).toLowerCase() : "";
const status = String(job.status || job.state || "").toUpperCase();

  });

  const best = hit || outs.find(x => x && (x.archive_url || x.url)) || outs[0];
  if(!best) return "";

  return String(best.archive_url || best.url || "").trim();
}


  function acceptVideoOutput(o){
    if(!o) return false;
    const t = String(o.type || "").toLowerCase();
    if(t === "video") return true;
    // some outputs may store type in meta
    const mt = o.meta && o.meta.type ? String(o.meta.type).toLowerCase() : "";
    return mt === "video";
  }

  function ensureDBJobs(){
    if(!window.DBJobs || typeof window.DBJobs.create !== "function"){
      console.warn("[panel.video] DBJobs missing. Did you include panel.dbjobs.js before panel.video.js?");
      return null;
    }
    return window.DBJobs;
  }

  function renderEmpty(root){
    root.innerHTML = `
      <div style="padding:10px 0; opacity:.8;">
        <div style="font-weight:700; margin-bottom:6px;">Video yok</div>
        <div style="font-size:13px;">Henüz DB’de video job bulunamadı.</div>
      </div>
    `;
  }

  function renderError(root, msg){
    root.innerHTML = `
      <div style="padding:10px 0; color:#ffb3b3;">
        <div style="font-weight:700; margin-bottom:6px;">Hata</div>
        <div style="font-size:13px; opacity:.9;"><code>${escapeHtml(msg || "unknown")}</code></div>
      </div>
    `;
  }

function renderList(root, items, handlers){
  // CSS: mod.video.panel.css (vpGrid/vpCard/vpVideo/vpActions/vpIconBtn)
  // Items newest first expected
  const cards = (items || []).map(job => {
    const id = job.job_id || job.id || "";

    // ✅ status: job.status yoksa job.state’e düş
    const status = String(job.status || job.state || "").toUpperCase();

    const when = job.created_at || job.updated_at || "";
    const whenTxt = when ? fmtTime(when) : "";
    const provider = (job.provider || (job.meta && job.meta.provider) || "").toString();

    // ✅ outputs’ta URL var mı? varsa DONE kabul et
    const hasAnyUrl =
      Array.isArray(job.outputs) &&
      job.outputs.some(o => o && (o.archive_url || o.url));

    // ✅ URL/outputs varsa DONE say (state PENDING bile olsa)
    const isDone = hasAnyUrl || (status === "DONE" || status === "READY" || status === "COMPLETED");

    const isProcessing = (status === "PROCESSING" || status === "RUNNING" || status === "PENDING");
    const isError = (status === "ERROR" || status === "FAILED");

    const badge =
      isDone ? "DONE" :
      isProcessing ? "PROCESSING" :
      isError ? "ERROR" :
      status || "UNKNOWN";

    // ✅ URL seçimi (DONE true olunca video tag basılacak)
    const url = pickBestVideoUrl(job);

    // ... buradan sonrası aynı (videoTag / card template / actions)
    // const videoTag = ...
    // return `...`
  }).join("");

  root.innerHTML = `
    <div class="vpGrid">
      ${cards || ""}
    </div>
  `;

  // actions ... (aynı)
}


      // If done but url missing, still show card (debug)
      const videoTag = (url && isDone)
        ? `<video class="vpVideo" preload="metadata" playsinline controls src="${escapeHtml(url)}"></video>`
        : `<div class="vpThumb" style="opacity:.7; padding:10px; font-size:12px;">
             <div style="font-weight:700; margin-bottom:4px;">${escapeHtml(badge)}</div>
             <div style="opacity:.8;">${url ? "Hazır (video yükleniyor)" : "URL yok / henüz hazır değil"}</div>
           </div>`;

      return `
        <div class="vpCard" data-job-id="${escapeHtml(id)}" data-status="${escapeHtml(badge)}">
          <div class="vpThumbWrap">
            ${videoTag}
          </div>

          <div class="vpMetaRow" style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 10px;">
            <div style="min-width:0;">
              <div style="font-weight:700; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(provider || "video")}
              </div>
              <div style="opacity:.7; font-size:11px;">
                ${escapeHtml(whenTxt)} ${whenTxt ? "•" : ""} ${escapeHtml(badge)}
              </div>
            </div>

            <div class="vpActions" style="display:flex; gap:6px; flex-shrink:0;">
              <button class="vpIconBtn" data-act="download" title="İndir" ${url ? "" : "disabled"}>⬇️</button>
              <button class="vpIconBtn" data-act="share" title="Paylaş" ${url ? "" : "disabled"}>🔗</button>
              <button class="vpIconBtn" data-act="delete" title="Sil">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    root.innerHTML = `
      <div class="vpGrid">
        ${cards || ""}
      </div>
    `;

    // actions
    root.querySelectorAll(".vpCard").forEach(card => {
      const jobId = card.getAttribute("data-job-id") || "";
      const v = card.querySelector("video.vpVideo");

      // card click toggles play/pause if video exists
      card.addEventListener("click", (e) => {
        const actBtn = e.target && e.target.closest && e.target.closest("[data-act]");
        if(actBtn) return; // actions handled separately
        if(v){
          try{
            if(v.paused) v.play();
            else v.pause();
          }catch(_){}
        }
      });

      card.querySelectorAll("[data-act]").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const act = btn.getAttribute("data-act");
          const job = (handlers.getJob && handlers.getJob(jobId)) || null;
          const url = job ? pickBestVideoUrl(job) : "";

          if(act === "download"){
            if(!url) return;
            const a = document.createElement("a");
            a.href = url;
            a.download = "";
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
          }

          if(act === "share"){
            if(!url) return;
            try{
              if(navigator.share){
                await navigator.share({ url });
              }else if(navigator.clipboard){
                await navigator.clipboard.writeText(url);
                alert("Link panoya kopyalandı.");
              }else{
                prompt("Link:", url);
              }
            }catch(_){}
            return;
          }

          if(act === "delete"){
            if(!jobId) return;
            const ok = confirm("Bu videoyu silmek istiyor musun?");
            if(!ok) return;

            // soft delete (if endpoint exists) + optimistic UI remove
            if(handlers.onDelete) await handlers.onDelete(jobId);
            return;
          }
        });
      });
    });
  }

  const impl = {
    header: {
      title: "Video",
      meta: "DB source-of-truth",
      searchEnabled: true,
      searchPlaceholder: "Video ara..."
    },

    mount(root, payload, ctx){
      const DB = ensureDBJobs();
      if(!DB){
        renderError(root, "DBJobs missing");
        return () => {};
      }

      const state = {
        all: [],
        view: [],
        query: (ctx && ctx.getQuery) ? String(ctx.getQuery() || "") : ""
      };

      function applySearch(q){
        const qq = String(q || "").trim().toLowerCase();
        state.query = qq;

        if(!qq){
          state.view = state.all.slice();
        }else{
          state.view = state.all.filter(job => {
            const id = String(job.job_id || job.id || "");
            const st = String(job.status || "");
            const pr = String(job.provider || "");
            const p  = String(job.prompt || "");
            return (
              id.toLowerCase().includes(qq) ||
              st.toLowerCase().includes(qq) ||
              pr.toLowerCase().includes(qq) ||
              p.toLowerCase().includes(qq)
            );
          });
        }

        if(!state.view.length){
          renderEmpty(root);
        }else{
          renderList(root, state.view, {
            getJob: (id) => state.all.find(x => String(x.job_id||x.id||"") === String(id)),
            onDelete: async (id) => {
              // remove locally first, then attempt backend delete
              ctrl.remove(id);
              await ctrl.deleteJob(id);
              // refresh from DB after delete attempt
              ctrl.hydrate(true);
            }
          });
        }
      }

      // Controller: hydrate + poll processing
      const ctrl = DB.create({
        app: "video",
        acceptOutput: acceptVideoOutput,
        pollIntervalMs: 4000,
        hydrateEveryMs: 15000,
        debug: false,
        onChange: (items) => {
          state.all = Array.isArray(items) ? items.slice() : [];

          // header meta: counts
          const done = state.all.filter(j => ["DONE","READY","COMPLETED"].includes(String(j.status||"").toUpperCase())).length;
          const proc = state.all.filter(j => ["PROCESSING","RUNNING","PENDING"].includes(String(j.status||"").toUpperCase())).length;
          const err  = state.all.filter(j => ["ERROR","FAILED"].includes(String(j.status||"").toUpperCase())).length;

          if(ctx && typeof ctx.setHeader === "function"){
            ctx.setHeader({ title: "Video", meta: `${done} done • ${proc} processing • ${err} error` });
          }

          applySearch(state.query);
        }
      });

      // initial render while hydrating
      root.innerHTML = `<div style="padding:10px 0; opacity:.8;">Yükleniyor…</div>`;

      ctrl.start();

      // expose search
      impl.onSearch = (q) => applySearch(q);

      // unmount cleanup
      return function(){
        try{ ctrl.destroy(); }catch(_){}
      };
    },

    // manager calls this on search input
    onSearch(q){ /* wired in mount */ }
  };

  // register to RightPanel
  if(window.RightPanel && typeof window.RightPanel.register === "function"){
    window.RightPanel.register("video", impl);
  }else{
    console.warn("[panel.video] RightPanel missing. Load panel.manager.js before panel.video.js");
  }
})();
