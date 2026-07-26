// panel.cartoon.js
// DB source-of-truth + optimistic cartoon video cards
// - fresh ready kartta final oynatır
// - refresh / DB hydrate sonrası preview oynatır
// - download her zaman final url kullanır
// - character job'ları paneli tetiklemez

(function () {
  if (!window.RightPanel) return;
  if (!window.DBJobs) {
    console.warn("[CARTOON PANEL] DBJobs yok. panel.dbjobs.js yüklenmeli.");
    return;
  }

  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");

  const safeStr = (v) => String(v == null ? "" : v).trim();

  const panelLanguage = () => {
    try {
      const language = window.AIVO_STUDIO_I18N?.getLanguage?.();
      if (language) {
        return String(language).toLowerCase().startsWith("en") ? "en" : "tr";
      }
    } catch {}

    return String(
      window.AIVO_LANG ||
      document.documentElement.lang ||
      "tr"
    ).toLowerCase().startsWith("en") ? "en" : "tr";
  };

  const panelText = (trText, enText) =>
    panelLanguage() === "en" ? enText : trText;

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const isCartoonApp = (x) => {
    const a = norm(x);
    return a === "cartoon" || a.includes("cartoon");
  };

  const getJobApp = (job) =>
    String(
      job?.app ||
      job?.meta?.app ||
      job?.meta?.module ||
      job?.meta?.routeKey ||
      ""
    ).trim();

  const getOutApp = (o) =>
    String(
      o?.meta?.app ||
      o?.meta?.module ||
      o?.meta?.routeKey ||
      ""
    ).trim();

  const isJobCartoon = (job) => isCartoonApp(getJobApp(job));

  const isCharacterMode = (x) =>
    String(
      x?.mode ||
      x?.meta?.mode ||
      x?.detail?.mode ||
      ""
    )
      .trim()
      .toLowerCase() === "character";

  const toMaybeProxyUrl = (url) => {
    const u = safeStr(url);
    if (!u) return "";

    if (
      u.startsWith("/api/media/proxy?url=") ||
      u.includes("/api/media/proxy?url=")
    ) {
      try {
        const encoded = u.split("url=")[1] || "";
        return decodeURIComponent(encoded).split("#")[0];
      } catch {
        return u;
      }
    }

    return u;
  };

  const idOf = (it) => String(it?.job_id || it?.id || "").trim();

  const mapBadge = (job) => {
    const a = norm(job?.db_status);
    const b = norm(job?.status);
    const c = norm(job?.state);
    const st = (a || b || c || "").toUpperCase();

    if (st.includes("FAIL") || st.includes("ERROR")) {
      return { text: panelText("Hata", "Error"), kind: "bad" };
    }
    if (
      st.includes("READY") ||
      st.includes("DONE") ||
      st.includes("COMPLET") ||
      st.includes("SUCC")
    ) {
      return { text: panelText("Hazır", "Ready"), kind: "ok" };
    }
    if (
      st.includes("RUN") ||
      st.includes("PROC") ||
      st.includes("PEND") ||
      st.includes("QUEUE")
    ) {
      return { text: panelText("İşleniyor", "Processing"), kind: "mid" };
    }
    return { text: st ? st.slice(0, 18) : panelText("İşleniyor", "Processing"), kind: "mid" };
  };

  function pickOutputUrl(o) {
    return safeStr(
      o?.archive_url ||
      o?.archiveUrl ||
      o?.url ||
      o?.video_url ||
      o?.videoUrl ||
      o?.raw_url ||
      o?.rawUrl ||
      o?.meta?.archive_url ||
      o?.meta?.archiveUrl ||
      o?.meta?.url ||
      o?.meta?.video_url ||
      o?.meta?.videoUrl ||
      ""
    );
  }

  function outputVariant(o) {
    return safeStr(o?.meta?.variant).toLowerCase();
  }

  function isVideoOutput(o) {
    const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind);
    return !t || t === "video";
  }

  function filterCartoonOutputs(job) {
    const outs = Array.isArray(job?.outputs) ? job.outputs : [];
    return outs.filter((o) => {
      if (!isVideoOutput(o)) return false;
      const oa = getOutApp(o);
      if (oa && !isCartoonApp(oa)) return false;
      return true;
    });
  }

  function pickFinalVideoFromJob(job) {
    const meta = job?.meta || {};
    const outs = filterCartoonOutputs(job);

    const directFinal =
      safeStr(job?.final) ||
      safeStr(job?.final_url) ||
      safeStr(job?.final_video_url) ||
      safeStr(meta?.final) ||
      safeStr(meta?.final_url) ||
      safeStr(meta?.final_video_url);

    if (directFinal) return directFinal;

    const finalized = outs.find(
      (o) => outputVariant(o) === "finalized" || o?.meta?.is_final === true
    );
    if (finalized) {
      const u = pickOutputUrl(finalized);
      if (u) return u;
    }

    const provider = outs.find((o) => outputVariant(o) === "provider");
    if (provider) {
      const u = pickOutputUrl(provider);
      if (u) return u;
    }

    const first = outs.find((o) => isVideoOutput(o)) || outs[0];
    return pickOutputUrl(first);
  }

  function pickPreviewVideoFromJob(job) {
    const meta = job?.meta || {};
    const outs = filterCartoonOutputs(job);

    const directPreview =
      safeStr(job?.preview) ||
      safeStr(job?.preview_url) ||
      safeStr(job?.preview_video_url) ||
      safeStr(meta?.preview) ||
      safeStr(meta?.preview_url) ||
      safeStr(meta?.preview_video_url);

    if (directPreview) return directPreview;

    const preview = outs.find((o) => outputVariant(o) === "preview");
    if (preview) {
      const u = pickOutputUrl(preview);
      if (u) return u;
    }

    return "";
  }

  function ensureStyles() {
    if (document.getElementById("cartoonPanelStyles")) return;

    const css = `
      .cartoonPanelWrap{display:flex;flex-direction:column;gap:12px;}
      .cartoonPanelGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
      .cartoonPanelCard{position:relative;border-radius:18px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);overflow:hidden;}
      .cartoonPanelThumb{position:relative;border-radius:16px;overflow:hidden;margin:10px;background:#000;border:1px solid rgba(255,255,255,0.08);}
      .cartoonPanelThumb:before{content:"";display:block;padding-top:56.25%;}
      .cartoonPanelThumb.isPortrait:before{padding-top:140%;}
      .cartoonPanelVideo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}
      .cartoonPanelPill{position:absolute;left:14px;top:14px;z-index:3;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,0.10);backdrop-filter:blur(10px);}
      .cartoonPanelPill.ok{border-color:rgba(120,255,190,.22);}
      .cartoonPanelPill.mid{border-color:rgba(255,255,255,.10);}
      .cartoonPanelPill.bad{border-color:rgba(255,120,120,.25);}
      .cartoonPanelSkel{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(80% 80% at 50% 40%, rgba(175,120,255,.18), rgba(0,0,0,.70));overflow:hidden;}
      .cartoonPanelSkel:before{content:"";position:absolute;inset:-40%;background:linear-gradient(90deg,rgba(255,255,255,0.00),rgba(220,170,255,0.14),rgba(255,255,255,0.00));transform:rotate(18deg);animation:cartoonPanelShimmer 1.4s linear infinite;}
      @keyframes cartoonPanelShimmer{0%{transform:translateX(-30%) rotate(18deg);}100%{transform:translateX(30%) rotate(18deg);}}
      .cartoonPanelSkelLabel{position:relative;z-index:2;font-size:12px;font-weight:800;padding:8px 12px;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.10);}
      .cartoonPanelFooter{padding:10px 12px 12px 12px;display:flex;flex-direction:column;gap:8px;}
      .cartoonPanelMetaLine{font-size:12px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .cartoonPanelActions{display:flex;gap:8px;padding:10px;border-radius:14px;background:rgba(0,0,0,.20);border:1px solid rgba(255,255,255,0.06);}
      .cartoonPanelBtn{flex:1;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.04);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;}
      .cartoonPanelBtn[disabled]{opacity:.45;cursor:not-allowed;}
      .cartoonPanelBtn.danger{border-color:rgba(255,120,120,0.20);background:rgba(255,120,120,0.08);}
       @media (max-width: 980px){.cartoonPanelGrid{grid-template-columns:1fr;}}
    `;

    const style = document.createElement("style");
    style.id = "cartoonPanelStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createCartoonPanel(host) {
    ensureStyles();

    let destroyed = false;
    let currentDbItems = [];
    let searchTimer = null;
    let searchInputEl = null;
    let searchRootEl = null;

    const state = {
      query: "",
    };

    const optimistic = new Map();
    const hiddenDeletedIds = new Set();
    const cardCache =
      window.__CARTOON_CARD_CACHE__ ||
      (window.__CARTOON_CARD_CACHE__ = new Map());

    host.innerHTML = `
      <div class="cartoonPanelWrap">
        <div class="cartoonPanelGrid" data-grid></div>
      </div>
    `;

    const elGrid = host.querySelector("[data-grid]");
    const elStatus = null;

    const setStatus = (t) => {
      if (elStatus) elStatus.textContent = t;
    };

    let panelToastTimer = null;
    let panelToastElement = null;

    const hidePanelToast = () => {
      if (panelToastTimer) {
        clearTimeout(panelToastTimer);
        panelToastTimer = null;
      }

      if (!panelToastElement) return;
      panelToastElement.style.opacity = "0";
      panelToastElement.style.pointerEvents = "none";
    };

    const ensurePanelToast = () => {
      if (panelToastElement) return panelToastElement;

      const toast = document.createElement("div");
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");

      // Keep the AIVO toast visual without using the global toast portal.
      // The toast is positioned relative to the main module area, matching
      // the music panel placement while avoiding portal/layout repaint flash.
      toast.style.position = "fixed";
      toast.style.left = "16px";
      toast.style.right = "auto";
      toast.style.bottom = "22px";
      toast.style.zIndex = "2147483000";
      toast.style.width = "420px";
      toast.style.minHeight = "52px";
      toast.style.padding = "6px 14px";
      toast.style.boxSizing = "border-box";
      toast.style.display = "grid";
      toast.style.gridTemplateColumns = "32px minmax(0, 1fr) 32px";
      toast.style.alignItems = "center";
      toast.style.columnGap = "10px";
      toast.style.borderRadius = "14px";
      toast.style.border = "1px solid rgba(255,255,255,.22)";
      toast.style.background = "rgba(20,20,30,.96)";
      toast.style.boxShadow = "0 16px 42px rgba(0,0,0,.38)";
      toast.style.color = "rgba(255,255,255,.94)";
      toast.style.opacity = "0";
      toast.style.transition = "opacity .16s ease";
      toast.style.pointerEvents = "none";
      toast.style.backdropFilter = "none";
      toast.style.webkitBackdropFilter = "none";
      toast.style.filter = "none";
      toast.style.mixBlendMode = "normal";

      const icon = document.createElement("div");
      icon.style.width = "24px";
      icon.style.height = "24px";
      icon.style.margin = "0 auto";
      icon.style.display = "grid";
      icon.style.placeItems = "center";
      icon.style.borderRadius = "999px";
      icon.style.background = "rgba(255,255,255,.12)";
      icon.style.border = "1px solid rgba(255,255,255,.18)";
      icon.style.color = "#fff";
      icon.style.fontSize = "13px";

      const body = document.createElement("div");
      body.style.minWidth = "0";
      body.style.display = "flex";
      body.style.flexDirection = "column";
      body.style.alignItems = "center";
      body.style.justifyContent = "center";
      body.style.textAlign = "center";

      const title = document.createElement("div");
      title.style.width = "100%";
      title.style.fontSize = "17px";
      title.style.fontWeight = "800";
      title.style.lineHeight = "1.08";
      title.style.color = "rgba(255,255,255,.86)";

      const message = document.createElement("div");
      message.style.width = "100%";
      message.style.marginTop = "4px";
      message.style.fontSize = "14px";
      message.style.fontWeight = "600";
      message.style.lineHeight = "1.2";
      message.style.color = "rgba(255,255,255,.68)";

      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "✕";
      close.style.width = "24px";
      close.style.height = "24px";
      close.style.padding = "0";
      close.style.display = "grid";
      close.style.placeItems = "center";
      close.style.background = "transparent";
      close.style.border = "1px solid rgba(255,255,255,.18)";
      close.style.borderRadius = "12px";
      close.style.color = "rgba(255,255,255,.7)";
      close.style.fontSize = "14px";
      close.style.cursor = "pointer";
      close.style.pointerEvents = "auto";
      close.setAttribute("aria-label", panelText("Kapat", "Close"));
      close.addEventListener("click", hidePanelToast);

      body.appendChild(title);
      body.appendChild(message);
      toast.appendChild(icon);
      toast.appendChild(body);
      toast.appendChild(close);

      toast.__icon = icon;
      toast.__title = title;
      toast.__message = message;
      toast.__close = close;

      document.body.appendChild(toast);
      panelToastElement = toast;
      return toast;
    };

    const positionPanelToast = (toast) => {
      if (!toast) return;

      const anchor =
        document.getElementById("moduleHost") ||
        document.querySelector("[data-module-host]") ||
        document.getElementById("mainWorkspace") ||
        host.closest("#moduleHost, #mainWorkspace") ||
        host.parentElement;

      const viewportPadding = 16;
      const preferredWidth = 420;
      const width = Math.min(
        preferredWidth,
        Math.max(280, window.innerWidth - viewportPadding * 2)
      );

      let left = Math.round((window.innerWidth - width) / 2);

      try {
        const rect = anchor?.getBoundingClientRect?.();
        if (rect && rect.width > 0) {
          left = Math.round(rect.left + (rect.width - width) / 2);
        }
      } catch {}

      left = Math.max(
        viewportPadding,
        Math.min(left, window.innerWidth - width - viewportPadding)
      );

      toast.style.width = `${width}px`;
      toast.style.left = `${left}px`;
      toast.style.right = "auto";
      toast.style.bottom = "22px";
    };

    const showPanelToast = (type, trMessage, enMessage) => {
      const toast = ensurePanelToast();
      positionPanelToast(toast);
      const isEnglish = panelLanguage() === "en";

      const titleMap = {
        success: isEnglish ? "Success" : "Başarılı",
        error: isEnglish ? "Error" : "Hata",
        info: isEnglish ? "Information" : "Bilgi",
      };

      const iconMap = { success: "✓", error: "!", info: "i" };

      toast.__icon.textContent = iconMap[type] || "i";
      toast.__title.textContent = titleMap[type] || titleMap.info;
      toast.__message.textContent = isEnglish ? enMessage : trMessage;
      toast.__close.setAttribute("aria-label", isEnglish ? "Close" : "Kapat");

      toast.style.borderColor =
        type === "error"
          ? "rgba(255,105,105,.42)"
          : type === "info"
            ? "rgba(120,190,255,.38)"
            : "rgba(110,235,170,.38)";

      if (panelToastTimer) clearTimeout(panelToastTimer);

      toast.style.pointerEvents = "auto";
      toast.style.opacity = "1";

      panelToastTimer = setTimeout(hidePanelToast, 2800);
    };

    const resolvePanelSearchInput = () => {
      const candidates = [
        ...document.querySelectorAll('input.rpSearch'),
        ...document.querySelectorAll('[data-right-panel-search]'),
        ...document.querySelectorAll('input[type="search"]'),
      ];

      const panelRoot =
        host.closest('[data-right-panel-root], .rightPanel, .rpShell, .rpWrap, .rpPanel, .RightPanel') ||
        host.parentElement ||
        document;

      for (const input of candidates) {
        if (!(input instanceof HTMLElement)) continue;

        const root =
          input.closest('[data-right-panel-root], .rightPanel, .rpShell, .rpWrap, .rpPanel, .RightPanel') ||
          input.parentElement;

        if (root && panelRoot && root === panelRoot) return input;
      }

      for (const input of candidates) {
        if (!(input instanceof HTMLElement)) continue;
        const ph = safeStr(input.getAttribute("placeholder") || "").toLowerCase();
        const aria = safeStr(input.getAttribute("aria-label") || "").toLowerCase();
        const cls = safeStr(input.className || "").toLowerCase();

        if (
          ph.includes("ara") ||
          ph.includes("search") ||
          aria.includes("ara") ||
          aria.includes("search") ||
          cls.includes("rpsearch")
        ) {
          return input;
        }
      }

      return candidates[0] || null;
    };

    const ensureSearchBinding = () => {
      const nextInput = resolvePanelSearchInput();
      if (!nextInput) return null;

      if (searchInputEl === nextInput) return searchInputEl;

      searchInputEl = nextInput;
      searchRootEl =
        searchInputEl.closest('[data-right-panel-root], .rightPanel, .rpShell, .rpWrap, .rpPanel, .RightPanel') ||
        searchInputEl.parentElement ||
        null;

      return searchInputEl;
    };

    const syncSearchFromInput = () => {
      const input = ensureSearchBinding();
      const nextQuery = safeStr(input?.value || "");
      if (state.query === nextQuery) return;

      if (searchTimer) clearTimeout(searchTimer);

      searchTimer = setTimeout(() => {
        state.query = nextQuery;
        renderCurrent();
      }, 120);
    };

    const onSearchInput = (e) => {
      const input = ensureSearchBinding();
      if (!input) return;

      if (e.target === input) {
        syncSearchFromInput();
        return;
      }

      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      if (searchRootEl && input.contains && searchRootEl.contains(target) && target === input) {
        syncSearchFromInput();
      }
    };

    document.addEventListener("input", onSearchInput, true);
    document.addEventListener("search", onSearchInput, true);
    setTimeout(() => {
      ensureSearchBinding();
      syncSearchFromInput();
    }, 0);

    const toMs = (v) => {
      if (v == null) return 0;
      if (typeof v === "number" && Number.isFinite(v)) return v;

      const s = String(v).trim();

      if (/^\d{10,13}$/.test(s)) {
        const n = Number(s);
        if (Number.isFinite(n)) return n;
      }

      if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s) && !s.includes("T")) {
        const iso = s.replace(" ", "T") + "Z";
        const tIso = Date.parse(iso);
        if (Number.isFinite(tIso)) return tIso;
      }

      const t = Date.parse(s);
      return Number.isFinite(t) ? t : 0;
    };

    const formatTs = (v) => {
      try {
        const t = toMs(v);
        if (!t) return "";
        const d = new Date(t);
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
    };

  const getCardTitle = (job) =>
  safeStr(
    job?.meta?.scene_title ||
    job?.meta?.title ||
    job?.title ||
    job?.meta?.prompt ||
    job?.prompt ||
    ""
  );
   const buildSearchHaystack = (job) => {
  return safeStr(getCardTitle(job)).toLowerCase();
};
    const isTerminalState = (job) => {
      const st = norm(job?.db_status || job?.status || job?.state);
      return (
        st.includes("ready") ||
        st.includes("done") ||
        st.includes("complet") ||
        st.includes("succ") ||
        st.includes("error") ||
        st.includes("fail")
      );
    };

    function hasProcessing(items) {
      return (items || []).some((j) => {
        const st = norm(j?.db_status || j?.status || j?.state).toUpperCase();
        return (
          st.includes("PROCESS") ||
          st.includes("RUN") ||
          st.includes("PEND") ||
          st.includes("QUEUE")
        );
      });
    }

    function renderCard(job) {
      const jid = idOf(job);
      const badge = mapBadge(job);
      const isFreshCard = job?._fresh === true;

      const finalUrl = pickFinalVideoFromJob(job);
      const previewUrl = pickPreviewVideoFromJob(job);

      const selectedPlaybackRawUrl = isFreshCard
        ? finalUrl || previewUrl
        : previewUrl || finalUrl;

      const playbackUrl = toMaybeProxyUrl(selectedPlaybackRawUrl);
      const ready = badge.kind === "ok" && !!playbackUrl;
      const previewVideoUrl = ready
        ? playbackUrl.includes("#")
          ? playbackUrl
          : playbackUrl + "#t=0.001"
        : "";

      const ratio = String(
        job?.meta?.ui_state?.aspect_ratio ||
          job?.meta?.aspect_ratio ||
          job?.meta?.ratio ||
          "16:9"
      ).trim();

      const title = getCardTitle(job);

      const sub = "";
      const badgeText = badge.text;
      const badgeKind =
        badge.kind === "ok"
          ? "ready"
          : badge.kind === "bad"
            ? "error"
            : "loading";

      if (window.AIVO_SHARED_VIDEO_CARD?.createCardHtml) {
        let sharedCardHtml = window.AIVO_SHARED_VIDEO_CARD.createCardHtml({
          id: jid,
          title,
          sub,
          badgeText,
          badgeKind,
          videoUrl: previewVideoUrl,
          posterUrl: safeStr(
            job?.poster_url ||
            job?.thumbnail_url ||
            job?.thumb_url ||
            job?.meta?.poster_url ||
            job?.meta?.thumbnail_url ||
            job?.meta?.thumb_url ||
            ""
          ),
          ratio,
          ready,
          canDownload: !!finalUrl,
          canShare: ready,
          canDelete: true,
        });

        const cardLabels = {
          Oynat: panelText("Oynat", "Play"),
          İndir: panelText("İndir", "Download"),
          Paylaş: panelText("Paylaş", "Share"),
          Büyüt: panelText("Büyüt", "Fullscreen"),
          Sil: panelText("Sil", "Delete"),
          "Sesi Aç": panelText("Sesi Aç", "Unmute"),
        };

        Object.entries(cardLabels).forEach(([from, to]) => {
          sharedCardHtml = sharedCardHtml
            .replaceAll(`title="${from}"`, `title="${esc(to)}"`)
            .replaceAll(`aria-label="${from}"`, `aria-label="${esc(to)}"`);
        });

 return (
  '<div class="cartoonPanelCardInner"' +
    ' data-job="' + esc(jid) + '"' +
    ' data-url="' + esc(selectedPlaybackRawUrl) + '"' +
    ' data-final-url="' + esc(finalUrl) + '"' +
    ' data-preview-url="' + esc(previewUrl) + '"' +
    ' data-fresh="' + esc(isFreshCard ? "1" : "0") + '"' +
  '>' +
    sharedCardHtml +
  '</div>'
);
      }

      return "";
    }

    function ensureCardEl(job) {
      const id = idOf(job);
      if (!id) return null;

      let el = cardCache.get(id);
      if (el && el.isConnected) return el;

      el = document.createElement("div");
      el.className = "cartoonPanelCard";
      el.setAttribute("data-job", id);

      el.innerHTML = `
        <div class="cartoonPanelThumb">
          <div class="cartoonPanelPill mid">${esc(panelText("İşleniyor", "Processing"))}</div>
          <div class="cartoonPanelSkel"><div class="cartoonPanelSkelLabel">${esc(panelText("Hazırlanıyor…", "Preparing…"))}</div></div>
        </div>
        <div class="cartoonPanelFooter">
          <div class="cartoonPanelMetaLine"></div>
          <div class="cartoonPanelActions">
            <button class="cartoonPanelBtn" type="button" data-act="download" data-job="${esc(id)}" disabled>${esc(panelText("İndir", "Download"))}</button>
            <button class="cartoonPanelBtn" type="button" data-act="share" data-job="${esc(id)}" disabled>${esc(panelText("Paylaş", "Share"))}</button>
            <button class="cartoonPanelBtn danger" type="button" data-act="delete" data-job="${esc(id)}">${esc(panelText("Sil", "Delete"))}</button>
          </div>
        </div>
      `;

      cardCache.set(id, el);
      return el;
    }

    function patchCard(el, job) {
      if (!el || !job) return;

      const html = renderCard(job);
      if (!html) return;

      if (el.__renderedHtml !== html) {
        el.innerHTML = html;
        el.__renderedHtml = html;
      }

      el.setAttribute("data-job", idOf(job));
    }

    function buildMergedItems() {
      const byId = new Map();

      for (const j of currentDbItems) {
        const id = idOf(j);
        if (!id) continue;
        if (hiddenDeletedIds.has(id)) continue;

        byId.set(id, j);

        if (optimistic.has(id) && isTerminalState(j)) {
          optimistic.delete(id);
        }
      }

      for (const [id, j] of optimistic.entries()) {
        if (!id) continue;
        if (hiddenDeletedIds.has(id)) continue;
        if (!byId.has(id)) {
          byId.set(id, j);
        }
      }

      const merged = Array.from(byId.values()).sort((a, b) => {
        const ta =
          toMs(a?.updated_at) || toMs(a?.created_at) || toMs(a?.createdAt) || 0;
        const tb =
          toMs(b?.updated_at) || toMs(b?.created_at) || toMs(b?.createdAt) || 0;

        if (tb !== ta) return tb - ta;

        const ia = idOf(a);
        const ib = idOf(b);
        return ib.localeCompare(ia);
      });

      const q = safeStr(state.query).toLowerCase();
      if (!q) return merged;

      return merged.filter((job) => buildSearchHaystack(job).includes(q));
    }

    function render(items) {
      if (!elGrid) return;

      setStatus(hasProcessing(items) ? panelText("İşleniyor…", "Processing…") : panelText("Hazır", "Ready"));

      const list = Array.isArray(items) ? items : [];
      const EMPTY_ID = "cartoonEmptyState";
      let emptyEl = elGrid.querySelector(`#${EMPTY_ID}`);

      if (!list.length) {
        for (const ch of Array.from(elGrid.children)) {
          if (ch.id !== EMPTY_ID) elGrid.removeChild(ch);
        }

        if (!emptyEl) {
          emptyEl = document.createElement("div");
          emptyEl.id = EMPTY_ID;
          emptyEl.style.opacity = ".7";
          emptyEl.style.fontSize = "12px";
          emptyEl.style.padding = "4px 2px";
          elGrid.appendChild(emptyEl);
        }

        emptyEl.textContent = state.query
          ? panelText("Aramana uygun çizgifilm üretim bulunamadı.", "No cartoon videos matched your search.")
          : panelText("Henüz çizgifilm üretim yok.", "No cartoon videos yet.");

        return;
      } else if (emptyEl) {
        emptyEl.remove();
      }

      const wanted = new Set();
      let anchor = elGrid.firstChild;

      for (const job of list) {
        const id = idOf(job);
        if (!id) continue;

        wanted.add(id);

        const card = ensureCardEl(job);
        patchCard(card, job);

        if (!card.isConnected) {
          elGrid.insertBefore(card, anchor);
          continue;
        }

        if (card !== anchor) {
          elGrid.insertBefore(card, anchor);
        } else {
          anchor = anchor?.nextSibling || null;
        }
      }

      for (const ch of Array.from(elGrid.children)) {
        if (ch.id === EMPTY_ID) continue;
        const jid = String(ch.getAttribute?.("data-job") || "").trim();
        if (jid && !wanted.has(jid)) {
          elGrid.removeChild(ch);
        }
      }
    }

    function renderCurrent() {
      render(buildMergedItems());
    }

       async function download(url, filename = "cartoon.mp4") {
      let cleanUrl = String(url || "").trim();
      if (!cleanUrl) return "failed";

      cleanUrl = cleanUrl.includes("#")
        ? cleanUrl.split("#")[0]
        : cleanUrl;

      if (
        cleanUrl.startsWith("/api/media/proxy?url=") ||
        cleanUrl.includes("/api/media/proxy?url=")
      ) {
        try {
          const encoded = cleanUrl.split("url=")[1] || "";
          cleanUrl = decodeURIComponent(encoded).split("#")[0];
        } catch {}
      }

      try {
        const response = await fetch(cleanUrl, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("download_fetch_failed_" + response.status);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 1000);

        return "downloaded";
      } catch (err) {
        console.error("[CARTOON PANEL] download failed", err);
        const opened = window.open(cleanUrl, "_blank", "noopener");
        return opened ? "opened" : "failed";
      }
    }

    async function share(url) {
      const cleanUrl = String(url || "").trim();
      if (!cleanUrl) return "failed";

      const directUrl = cleanUrl.includes("#")
        ? cleanUrl.split("#")[0]
        : cleanUrl;

      try {
        if (navigator.share) {
          await navigator.share({ url: directUrl });
          return "shared";
        }

        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(directUrl);
          return "copied";
        }
      } catch (error) {
        if (error?.name === "AbortError") return "cancelled";
        console.error("[CARTOON PANEL] share failed", error);
      }

      return "failed";
    }

    host.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-svc-act], [data-act]");
      if (!btn) return;

      const act = btn.dataset.svcAct || btn.dataset.act;
      const card = btn.closest(".svcCard, .cartoonPanelCard");
      const id = String(
        btn.dataset.id ||
          btn.dataset.job ||
          card?.dataset?.svcId ||
          card?.dataset?.job ||
          ""
      ).trim();

      if (!act || !id) return;

      const allItems = [...currentDbItems, ...Array.from(optimistic.values())];
      const job = allItems.find((x) => idOf(x) === id);
      if (!job) return;

      if (act === "play") {
        e.preventDefault();
        e.stopPropagation();

        const video = card?.querySelector("video.svcVideo");
        if (!video) return;

        if (video.paused) video.play().catch(() => {});
        else video.pause();

        return;
      }

      const finalUrl = pickFinalVideoFromJob(job);
      const previewUrl = pickPreviewVideoFromJob(job);
      const sharePlaybackUrl = safeStr(
        (job?._fresh === true ? finalUrl || previewUrl : previewUrl || finalUrl)
      );

      if (act === "open") {
        e.preventDefault();
        e.stopPropagation();
        if (!sharePlaybackUrl) return;
        window.open(sharePlaybackUrl, "_blank", "noopener");
        return;
      }

      if (act === "download") {
        e.preventDefault();
        e.stopPropagation();
        if (!finalUrl) return;

        const result = await download(finalUrl, `cartoon-${id}.mp4`);

        if (result === "downloaded") {
          showPanelToast(
            "success",
            "Çizgifilm videosu indirildi.",
            "Cartoon video downloaded."
          );
        } else if (result === "opened") {
          showPanelToast(
            "info",
            "Video yeni sekmede açıldı.",
            "The video was opened in a new tab."
          );
        } else {
          showPanelToast(
            "error",
            "Çizgifilm videosu indirilemedi.",
            "Cartoon video could not be downloaded."
          );
        }

        return;
      }

      if (act === "share") {
        e.preventDefault();
        e.stopPropagation();
        if (!sharePlaybackUrl) return;

        const result = await share(sharePlaybackUrl);
        if (result === "shared") {
          showPanelToast(
            "success",
            "Paylaşım penceresi açıldı.",
            "The share dialog was opened."
          );
        } else if (result === "copied") {
          showPanelToast(
            "success",
            "Video bağlantısı kopyalandı.",
            "Video link copied."
          );
        } else if (result !== "cancelled") {
          showPanelToast(
            "error",
            "Video paylaşılamadı.",
            "The video could not be shared."
          );
        }

        return;
      }

      if (act === "delete") {
        e.preventDefault();
        e.stopPropagation();

        try {
          hiddenDeletedIds.add(id);
          optimistic.delete(id);
          currentDbItems = currentDbItems.filter((x) => idOf(x) !== id);

          renderCurrent();

          const ok = await controller.deleteJob(id);
          if (!ok) {
            hiddenDeletedIds.delete(id);
            try {
              await controller?.hydrate?.(true);
            } catch {}
            console.error("[CARTOON PANEL] delete failed");
            showPanelToast(
              "error",
              "Çizgifilm videosu silinemedi.",
              "Cartoon video could not be deleted."
            );
            return;
          }

          try {
            await controller?.hydrate?.(true);
          } catch {}

          showPanelToast(
            "success",
            "Çizgifilm videosu silindi.",
            "Cartoon video deleted."
          );
        } catch (err) {
          hiddenDeletedIds.delete(id);
          try {
            await controller?.hydrate?.(true);
          } catch {}
          console.error("[CARTOON PANEL] delete failed", err);
          showPanelToast(
            "error",
            "Çizgifilm videosu silinemedi.",
            "Cartoon video could not be deleted."
          );
        }

        return;
      }
    });

    const controller = window.DBJobs.create({
      app: "cartoon",
      debug: false,
      pollIntervalMs: 4000,
      hydrateEveryMs: 15000,

      acceptJob: (job) => {
        if (!job) return false;
        const ja = getJobApp(job);
        if (ja && !isCartoonApp(ja)) return false;
        if (isCharacterMode(job)) return false;
        return true;
      },

      acceptOutput: (o) => {
        if (!o) return false;
        if (!isVideoOutput(o)) return false;
        const oa = getOutApp(o);
        if (oa && !isCartoonApp(oa)) return false;
        return true;
      },

      onChange: async (items) => {
        if (destroyed) return;

        currentDbItems = (items || [])
          .filter(isJobCartoon)
          .filter((j) => !isCharacterMode(j))
          .filter((j) => {
            const id = idOf(j);
            return id && !hiddenDeletedIds.has(id);
          })
          .map((j) => ({
            ...j,
            _fresh: false,
          }));

        renderCurrent();
      },
    });

    const onJobCreated = (e) => {
      const d = e?.detail || {};
      if (!d.job_id) return;
      if (!isCartoonApp(d.app || d.meta?.app || "cartoon")) return;
      if (isCharacterMode(d) || isCharacterMode(d.meta)) return;

      const job_id = String(d.job_id || "").trim();
      if (!job_id) return;
      if (hiddenDeletedIds.has(job_id)) return;

      const existsDb = currentDbItems.some((j) => idOf(j) === job_id);
      if (existsDb) return;
      if (optimistic.has(job_id)) return;

      const meta = d.meta || {};
      const createdAt = d.createdAt || Date.now();

      optimistic.set(job_id, {
        job_id,
        app: "cartoon",
        provider: meta.provider || "Cartoon",
        createdAt,
        created_at: createdAt,
        db_status: "processing",
        status: "processing",
        state: "PROCESSING",
        _fresh: false,
        meta: {
          ...(meta || {}),
          app: "cartoon",
          duration: meta.duration || "",
          prompt: meta.prompt || "",
        },
        outputs: [],
      });

      renderCurrent();
    };

    const onJobReady = (e) => {
      const d = e?.detail || {};
      const job_id = String(d?.job_id || "").trim();
      if (!job_id) return;
      if (hiddenDeletedIds.has(job_id)) return;

      const videoUrl = safeStr(
        d?.video?.url || d?.raw?.video?.url || d?.raw?.video_url || ""
      );

      const outputs = Array.isArray(d?.outputs) ? d.outputs : [];

      const existingDb = currentDbItems.find((j) => idOf(j) === job_id);

      if (existingDb) {
        existingDb.db_status = "ready";
        existingDb.status = "ready";
        existingDb.state = "COMPLETED";
        existingDb._fresh = true;

        if (outputs.length) {
          existingDb.outputs = outputs;
        } else if (videoUrl) {
          existingDb.outputs = [
            {
              type: "video",
              url: videoUrl,
              meta: { app: "cartoon", variant: "provider", is_final: true },
            },
          ];
        }

        if (optimistic.has(job_id)) {
          optimistic.delete(job_id);
        }

        renderCurrent();
        return;
      }

      const optimisticJob = optimistic.get(job_id);

      const nextOutputs = outputs.length
        ? outputs
        : videoUrl
          ? [
              {
                type: "video",
                url: videoUrl,
                meta: { app: "cartoon", variant: "provider", is_final: true },
              },
            ]
          : optimisticJob?.outputs || [];

      if (!optimisticJob) {
        optimistic.set(job_id, {
          job_id,
          app: "cartoon",
          provider: "Cartoon",
          createdAt: Date.now(),
          created_at: Date.now(),
          db_status: "ready",
          status: "ready",
          state: "COMPLETED",
          _fresh: true,
          meta: {
            ...(d?.meta || {}),
            ...(d?.raw?.meta || {}),
            app: "cartoon",
            title:
              d?.raw?.meta?.title ||
              d?.meta?.title ||
              "cartoon studio export",
          },
          outputs: nextOutputs,
        });

        renderCurrent();
        return;
      }

      optimistic.set(job_id, {
        ...optimisticJob,
        _fresh: true,
        db_status: "ready",
        status: "ready",
        state: "COMPLETED",
        outputs: nextOutputs,
      });

      renderCurrent();
    };

    const onJobFailed = (e) => {
      const d = e?.detail || {};
      const job_id = String(d?.job_id || "").trim();
      if (!job_id) return;

      const app = String(d?.app || "").trim().toLowerCase();
      if (app && !isCartoonApp(app)) return;

      optimistic.delete(job_id);
      hiddenDeletedIds.add(job_id);
      currentDbItems = currentDbItems.filter((j) => idOf(j) !== job_id);

      const cachedCard = cardCache.get(job_id);
      if (cachedCard && cachedCard.isConnected) {
        try { cachedCard.remove(); } catch {}
      }

      renderCurrent();

      setTimeout(() => {
        hiddenDeletedIds.delete(job_id);
      }, 1500);
    };

    controller.start();
    window.addEventListener("aivo:cartoon:job_created", onJobCreated);
    window.addEventListener("aivo:cartoon:job_ready", onJobReady);
    window.addEventListener("aivo:cartoon:story_scene_ready", onJobReady);
    window.addEventListener("aivo:cartoon:job_failed", onJobFailed);
    window.addEventListener("aivo:cartoon:job_remove", onJobFailed);

    return {
      destroy() {
        destroyed = true;

        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = null;
        searchInputEl = null;
        searchRootEl = null;

        try {
          document.removeEventListener("input", onSearchInput, true);
        } catch {}
        try {
          document.removeEventListener("search", onSearchInput, true);
        } catch {}
        try {
          window.removeEventListener("aivo:cartoon:job_created", onJobCreated);
        } catch {}
        try {
          window.removeEventListener("aivo:cartoon:job_ready", onJobReady);
        } catch {}
        try {
          window.removeEventListener(
            "aivo:cartoon:story_scene_ready",
            onJobReady
          );
        } catch {}
        try {
          window.removeEventListener("aivo:cartoon:job_failed", onJobFailed);
        } catch {}
        try {
          window.removeEventListener("aivo:cartoon:job_remove", onJobFailed);
        } catch {}
        try {
          controller?.destroy?.();
        } catch {}
        try {
          if (panelToastTimer) clearTimeout(panelToastTimer);
          panelToastTimer = null;
          panelToastElement?.remove?.();
          panelToastElement = null;
        } catch {}
        try {
          host.innerHTML = "";
        } catch {}
      },
    };
  }

  try {
    console.log("[PANEL.CARTOON] register run");
    if (typeof window.RightPanel.register === "function") {
      window.RightPanel.register("cartoon", {
        header: {
          title: panelText("AI Çocuk Çizgifilm", "AI Kids Cartoon"),
          meta: panelText("Hazır", "Ready"),
          searchEnabled: true,
          searchPlaceholder: panelText("Çizgifilmlerde ara...", "Search cartoon videos..."),
          resetSearch: true,
        },

        mount(host) {
          const api = createCartoonPanel(host);
          return () => {
            try {
              api?.destroy?.();
            } catch {}
          };
        },
      });
    } else {
      console.warn("[CARTOON PANEL] RightPanel.register yok.");
    }
  } catch (e) {
    console.warn("[CARTOON PANEL] register failed", e);
  }
})();
