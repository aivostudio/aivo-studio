// /js/panel.atmo.js
(function () {
  if (!window.RightPanel) return;

  const APP_KEY = "atmo";

  const safeStr = (v) => String(v == null ? "" : v).trim();
  const esc = (s) =>
    safeStr(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  // FAL atmo video status endpoint (app param şart)
  const STATUS_URL = (rid) =>
    `/api/providers/fal/video/status?request_id=${encodeURIComponent(rid)}&app=${APP_KEY}`;

  function pickVideoUrl(data) {
    return (
      data?.video?.url ||
      data?.video_url ||
      data?.output?.video?.url ||
      data?.output?.url ||
      (Array.isArray(data?.outputs) ? data.outputs?.[0]?.url : null) ||
      (Array.isArray(data?.output) ? data.output?.[0]?.url : null) ||
      data?.result?.url ||
      data?.result?.video?.url ||
      null
    );
  }

  function formatTs(ts) {
    try {
      const d = new Date(ts);
      if (Number.isNaN(+d)) return "";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${dd}.${mm}.${yy} ${hh}:${mi}`;
    } catch {
      return "";
    }
  }

  function bestVideoFromJob(job) {
    const outs = Array.isArray(job?.outputs) ? job.outputs : [];
    // prefer archive_url normalized by DBJobs
    const vid = outs.find((o) => (o?.type || "").toLowerCase() === "video") || outs[0];
    return vid?.archive_url || vid?.url || vid?.raw_url || "";
  }

  function acceptAtmoOutput(o) {
    if (!o) return false;
    const t = String(o.type || "").toLowerCase();
    if (t && t !== "video") return false;

    const app =
      String(o?.meta?.app || o?.meta?.module || o?.meta?.routeKey || "")
        .toLowerCase()
        .trim();

    // atmo çıktısı ya meta.app=atmo olur ya da boş gelir; boş gelene izin veriyoruz
    if (!app) return true;
    return app.includes("atmo");
  }

  function createAtmosPanel(host) {
    let destroyed = false;
    let timer = null;

    // panel state
    const state = {
      items: [],
      q: "",
      selectedUrl: "",
      selectedJobId: "",
      selectedTitle: "",
    };

    // --- UI (CSS: /css/mod.atmo.panel.css) ---
    host.innerHTML = `
      <div class="atmoPanel">

        <div class="atmoPanelHeader">
          <div class="atmoPanelTitleRow">
            <div class="atmoPanelTitle">Atmosfer Video</div>
            <div class="atmoPanelStatus" data-el="status">Hazır</div>
          </div>

          <input
            class="atmoPanelSearch"
            data-el="search"
            placeholder="Videolarda ara..."
          />
        </div>

        <div class="atmoPlayerCard">

          <div class="atmoPlayerHint" data-el="hint">
            Bir karttan ▶ seçip oynat.
          </div>

          <div class="atmoPlayerViewport" data-el="viewport">
            <!-- VIDEO MOUNT (boşken DOM’da video YOK) -->
            <div class="atmoPlayerMount" data-el="playerMount"></div>

            <!-- PLACEHOLDER / POSTER -->
            <div class="atmoPoster is-empty" data-el="poster">
              <div class="atmoPosterInner">
                <div class="atmoPosterPlay" data-el="posterPlay" title="Oynat">▶</div>
                <div class="atmoPosterText" data-el="empty">
                  Henüz seçili video yok.
                </div>
              </div>
            </div>
          </div>

          <div class="atmoSubHint" data-el="subhint">
            Henüz atmo üretim yok.
          </div>

        </div>

        <div class="atmoGrid" data-el="grid"></div>

      </div>
    `;

    const $status = host.querySelector('[data-el="status"]');
    const $search = host.querySelector('[data-el="search"]');
    const $hint = host.querySelector('[data-el="hint"]');
    const $subhint = host.querySelector('[data-el="subhint"]');
    const $grid = host.querySelector('[data-el="grid"]');

    const $playerMount = host.querySelector('[data-el="playerMount"]');
    const $poster = host.querySelector('[data-el="poster"]');
    const $posterPlay = host.querySelector('[data-el="posterPlay"]');
    const $empty = host.querySelector('[data-el="empty"]');

    const setStatus = (t) => { if ($status) $status.textContent = t; };

    function teardownPlayer() {
      if (!$playerMount) return;
      $playerMount.innerHTML = "";
    }

    function getPlayerEl() {
      if (!$playerMount) return null;
      return $playerMount.querySelector("video");
    }

    function showPoster(show) {
      if (!$poster) return;
      $poster.style.display = show ? "grid" : "none";
      if (show) $poster.classList.add("is-empty");
      else $poster.classList.remove("is-empty");
    }

    function ensurePlayer(url) {
      if (!$playerMount) return null;

      // her seferinde sıfırdan kurmak Safari/iOS için daha stabil
      teardownPlayer();

      const v = document.createElement("video");
      v.className = "atmoPlayer";
      v.playsInline = true;
      v.preload = "metadata";
      v.controls = true; // URL geldikten sonra aç
      v.setAttribute("playsinline", "");
      v.setAttribute("preload", "metadata");
      v.setAttribute("controls", "");

      // src set
      v.src = url;

      $playerMount.appendChild(v);
      try { v.load?.(); } catch {}
      return v;
    }

    function setMain(url, meta) {
      url = safeStr(url);

      state.selectedJobId = meta?.job_id || "";
      state.selectedTitle = meta?.title || "";

      if (!url) {
        state.selectedUrl = "";
        if ($empty) $empty.textContent = "Henüz seçili video yok.";
        showPoster(true);
        teardownPlayer();
        return;
      }

      state.selectedUrl = url;
      if ($empty) $empty.textContent = "";
      showPoster(false);

      // aynı url zaten seçiliyse player’ı tekrar kurma (göz kırpma önle)
      const current = getPlayerEl();
      const currentSrc = current ? safeStr(current.currentSrc || current.src) : "";
      if (current && currentSrc && currentSrc === url) return;

      ensurePlayer(url);
    }

    // Poster click -> mevcut seçili varsa play/pause
    if ($posterPlay) {
      $posterPlay.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!state.selectedUrl) return;
        const v = getPlayerEl();
        if (v) {
          try {
            if (v.paused) v.play?.();
            else v.pause?.();
          } catch {}
        } else {
          setMain(state.selectedUrl, { job_id: state.selectedJobId, title: state.selectedTitle });
          const v2 = getPlayerEl();
          try { v2 && v2.play?.(); } catch {}
        }
      });
    }

    function isMatch(job) {
      if (!state.q) return true;
      const q = state.q.toLowerCase();
      const p = safeStr(job?.prompt).toLowerCase();
      const ts = formatTs(job?.created_at || job?.updated_at);
      return p.includes(q) || ts.includes(q);
    }

    function cardTitle(job) {
      // küçük, net: "Atmosfer • dd.mm.yyyy hh:mm"
      const ts = formatTs(job?.created_at || job?.updated_at);
      return ts ? `Atmosfer • ${ts}` : "Atmosfer";
    }

    function render() {
      if (destroyed) return;

      const items = (state.items || []).filter(isMatch);

      // hints
      if ($subhint) $subhint.textContent = items.length ? "" : "Henüz atmo üretim yok.";
      if ($hint) $hint.style.display = items.length ? "block" : "none";

      if (!$grid) return;

      if (!items.length) {
        $grid.innerHTML = "";
        // seçili varsa koru; yoksa poster kalsın
        setMain(state.selectedUrl);
        return;
      }

      const html = items.slice(0, 12).map((job) => {
        const url = bestVideoFromJob(job);
        const st = String(job?.state || job?.status || "").toUpperCase();
        const done =
          st.includes("COMPLETE") ||
          st.includes("READY") ||
          st.includes("DONE") ||
          st.includes("SUCCEEDED") ||
          st.includes("COMPLETED");
        const badge = done ? "Hazır" : (st.includes("FAIL") ? "Hata" : "İşleniyor");

        const active = (url && state.selectedUrl && url === state.selectedUrl) ? " is-active" : "";
        const title = cardTitle(job);
        const prompt = safeStr(job?.prompt);

        return `
          <div class="atmoCard${active}" data-job="${esc(job.job_id || "")}" data-url="${esc(url)}">
            <div class="atmoCardMedia">
              <div class="atmoBadge">${esc(badge)}</div>
              <div class="atmoPlayBtn" title="Oynat">▶</div>
            </div>

            <div class="atmoCardBody">
              <div class="atmoCardTitle">${esc(title)}</div>
              <div class="atmoCardPrompt">${esc(prompt || "—")}</div>

              <div class="atmoCardActions">
                <button class="atmoIconBtn" data-act="download" title="İndir">⬇</button>
                <button class="atmoIconBtn" data-act="share" title="Paylaş">↗</button>
                <button class="atmoIconBtn atmoDanger" data-act="delete" title="Sil">🗑</button>
              </div>
            </div>
          </div>
        `;
      }).join("");

      $grid.innerHTML = html;

      // click binding (delegate)
      $grid.onclick = async (e) => {
        const card = e.target.closest(".atmoCard");
        if (!card) return;

        const url = safeStr(card.getAttribute("data-url"));
        const jobId = safeStr(card.getAttribute("data-job"));

        const actBtn = e.target.closest("[data-act]");
        if (actBtn) {
          const act = actBtn.getAttribute("data-act");
          if (act === "download") {
            if (!url) return;
            const a = document.createElement("a");
            a.href = url;
            a.download = "";
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
          }
          if (act === "share") {
            if (!url) return;
            try {
              if (navigator.share) await navigator.share({ url, title: "Atmosfer Video" });
              else await navigator.clipboard.writeText(url);
            } catch {}
            return;
          }
          if (act === "delete") {
            if (!jobId) return;
            // optimistik kaldır; backend varsa DBJobs.deleteJob halleder
            if (db) await db.deleteJob(jobId);
            else {
              state.items = (state.items || []).filter((x) => x.job_id !== jobId);
              render();
            }
            // seçili silindiyse player’ı kapat
            if (state.selectedJobId === jobId) setMain("");
            return;
          }
        }

        // normal click -> select
        if (url) setMain(url, { job_id: jobId, title: "Atmosfer" });

        // kullanıcı nereden basarsa bassın, hero hazır olsun
        // (autoplay yok; poster play ile başlatır)
      };
    }

    // search
    if ($search) {
      $search.addEventListener("input", () => {
        state.q = safeStr($search.value);
        render();
      });
    }

  // --- DB controller (single source of truth) ---
const db = (window.DBJobs && typeof window.DBJobs.create === "function")
  ? window.DBJobs.create({
      app: APP_KEY,
      debug: false,
      pollIntervalMs: 4000,
      hydrateEveryMs: 15000,
      acceptOutput: acceptAtmoOutput,
      onChange(items) {
        state.items = items || [];
        render();

        // ✅ seçili yoksa: ilk bulunan videoyu otomatik seç
        if (!state.selectedUrl) {
          const first = (state.items || []).find((j) => bestVideoFromJob(j));
          const url = first ? bestVideoFromJob(first) : "";
          if (url) {
            setMain(url, { job_id: first.job_id || "", title: "Atmosfer" });
          }
        }
      }
    })
  : null;

if (db) db.start();


    // --- AIVO_JOBS.upsert hook (anlık job yakalama; DB gelene kadar) ---
    const originalUpsert = window.AIVO_JOBS && window.AIVO_JOBS.upsert;

    if (originalUpsert && !window.__AIVO_ATMO_UPSERT_HOOKED__) {
      window.__AIVO_ATMO_UPSERT_HOOKED__ = true;

      window.AIVO_JOBS.upsert = function (job) {
        try { originalUpsert.call(this, job); } catch {}

        try {
          if (!job) return;

          const key = (
            safeStr(job.routeKey) ||
            safeStr(job.app) ||
            safeStr(job.module) ||
            safeStr(job.type) ||
            safeStr(job.kind)
          ).toLowerCase();

          if (!key.includes("atmo")) return;

          // DB gelene kadar "processing" hissi
          setStatus("İşleniyor…");
          if ($subhint) $subhint.textContent = "Üretim devam ediyor…";

          // fal request id ile status poll (legacy bridge)
          const rid =
            safeStr(job.request_id) ||
            safeStr(job.requestId) ||
            safeStr(job.fal_request_id) ||
            safeStr(job.provider_request_id);

          if (!rid || rid === "TEST") return;

          // minimal: tek current status poll
          if (timer) clearInterval(timer);
          timer = setInterval(() => pollFalOnce(rid), 2000);
          pollFalOnce(rid);
        } catch {}
      };
    }

    async function pollFalOnce(rid) {
      if (destroyed) return;
      rid = safeStr(rid);
      if (!rid) return;

      let data;
      try {
        const r = await fetch(STATUS_URL(rid), { credentials: "include" });
        data = await r.json();
      } catch {
        setStatus("Bağlantı sorunu");
        return;
      }

      const st = safeStr(data?.status || data?.state || data?.result?.status).toLowerCase();

      if (st.includes("fail") || st === "error") {
        setStatus("Hata");
        if ($subhint) $subhint.textContent = "Video üretimi hata verdi.";
        return;
      }

      if (st.includes("complete") || st.includes("success") || st === "succeeded") {
        const url = pickVideoUrl(data);
        if (!url) {
          setStatus("Tamamlandı (url yok)");
          return;
        }

        setStatus("Tamamlandı");
        if ($subhint) $subhint.textContent = "";

        // main player’a yükle (admin için net)
        setMain(url, { title: "Atmosfer", job_id: "" });

        // PPE bridge
        try {
          if (window.PPE && typeof window.PPE.apply === "function") {
            window.PPE.apply({
              outputs: [{ type: "video", url, src: url, meta: { app: APP_KEY } }],
              meta: { app: APP_KEY, request_id: rid },
            });
          }
        } catch {}

        // DB hydrate ile listeyi de güncelle
        try { db && db.hydrate(true); } catch {}

        // stop polling
        if (timer) clearInterval(timer);
        timer = null;
        return;
      }

      setStatus("İşleniyor…");
    }

    // initial
    setStatus("Hazır");
    setMain("");

    function destroy() {
      destroyed = true;
      if (timer) clearInterval(timer);
      timer = null;
      try { db && db.destroy(); } catch {}
      teardownPlayer();
      host.innerHTML = "";
    }

    return { destroy };
  }

  window.RightPanel.register(APP_KEY, {
    mount(host) {
      const panel = createAtmosPanel(host);
      host.__ATMO_PANEL__ = panel;
    },
    destroy(host) {
      try { host.__ATMO_PANEL__ && host.__ATMO_PANEL__.destroy(); } catch {}
      host.__ATMO_PANEL__ = null;
    },
  });
})();
