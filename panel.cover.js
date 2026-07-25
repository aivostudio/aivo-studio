/* =========================================================
   AIVO Studio - Cover Right Panel
   File: /panel.cover.js

   - Desktop TR / EN support
   - Cover list hydration
   - Search, preview, download, share and delete
   - Localized status badges and toast messages
   ========================================================= */

(function AIVO_COVER_PANEL() {
  "use strict";

  if (window.__AIVO_COVER_PANEL__) return;
  window.__AIVO_COVER_PANEL__ = true;

  const PANEL_KEY = "cover";
  const hiddenDeletedIds = new Set();

  let coverSearchQuery = "";
  let coverHost = null;
  let coverController = null;

  const PANEL_DICTIONARY = {
    tr: {
      "studio.cover.panel.title": "Kapaklarım",
      "studio.cover.panel.search": "Kapaklarda ara...",
      "studio.cover.panel.empty": "Henüz kapak yok.",
      "studio.cover.panel.noResults": "Aramana uygun kapak bulunamadı.",
      "studio.cover.panel.ready": "Hazır",
      "studio.cover.panel.processing": "İşleniyor",
      "studio.cover.panel.failed": "Başarısız",
      "studio.cover.panel.open": "Görüntüle",
      "studio.cover.panel.download": "İndir",
      "studio.cover.panel.share": "Paylaş",
      "studio.cover.panel.delete": "Sil",
      "studio.cover.panel.downloaded": "Kapak indirildi.",
      "studio.cover.panel.downloadFailed": "Kapak indirilemedi.",
      "studio.cover.panel.openedNewTab": "Kapak yeni sekmede açıldı.",
      "studio.cover.panel.deleted": "Kapak silindi.",
      "studio.cover.panel.deleteFailed": "Kapak silinemedi.",
      "studio.cover.panel.linkCopied": "Kapak bağlantısı kopyalandı.",
      "studio.cover.panel.shareFailed": "Kapak paylaşılamadı.",
      "studio.cover.panel.shared": "Paylaşım penceresi açıldı."
    },
    en: {
      "studio.cover.panel.title": "My Covers",
      "studio.cover.panel.search": "Search covers...",
      "studio.cover.panel.empty": "No covers yet.",
      "studio.cover.panel.noResults": "No covers matched your search.",
      "studio.cover.panel.ready": "Ready",
      "studio.cover.panel.processing": "Processing",
      "studio.cover.panel.failed": "Failed",
      "studio.cover.panel.open": "View",
      "studio.cover.panel.download": "Download",
      "studio.cover.panel.share": "Share",
      "studio.cover.panel.delete": "Delete",
      "studio.cover.panel.downloaded": "Cover downloaded.",
      "studio.cover.panel.downloadFailed": "Cover could not be downloaded.",
      "studio.cover.panel.openedNewTab": "The cover was opened in a new tab.",
      "studio.cover.panel.deleted": "Cover deleted.",
      "studio.cover.panel.deleteFailed": "Cover could not be deleted.",
      "studio.cover.panel.linkCopied": "Cover link copied.",
      "studio.cover.panel.shareFailed": "Cover could not be shared.",
      "studio.cover.panel.shared": "The share dialog was opened."
    }
  };

  function normalizeLanguage(value) {
    return String(value || "").trim().toLowerCase().startsWith("en")
      ? "en"
      : "tr";
  }

  function currentLanguage() {
    try {
      if (
        window.AIVO_STUDIO_I18N &&
        typeof window.AIVO_STUDIO_I18N.getLanguage === "function"
      ) {
        return normalizeLanguage(window.AIVO_STUDIO_I18N.getLanguage());
      }
    } catch (_) {}

    return normalizeLanguage(
      window.AIVO_LANG ||
      document.documentElement.lang ||
      "tr"
    );
  }

  function registerDictionary() {
    try {
      if (
        window.AIVO_STUDIO_I18N &&
        typeof window.AIVO_STUDIO_I18N.registerPack === "function"
      ) {
        window.AIVO_STUDIO_I18N.registerPack(PANEL_DICTIONARY);
        return;
      }

      if (window.AIVO_I18N?.tr && window.AIVO_I18N?.en) {
        Object.assign(window.AIVO_I18N.tr, PANEL_DICTIONARY.tr);
        Object.assign(window.AIVO_I18N.en, PANEL_DICTIONARY.en);
      }
    } catch (error) {
      console.warn("[cover.panel] dictionary registration failed", error);
    }
  }

  function panelText(key) {
    const lang = currentLanguage();

    try {
      if (
        window.AIVO_STUDIO_I18N &&
        typeof window.AIVO_STUDIO_I18N.t === "function"
      ) {
        const translated = window.AIVO_STUDIO_I18N.t(key, "");
        if (translated && translated !== key) return translated;
      }
    } catch (_) {}

    try {
      if (typeof window.t === "function") {
        const translated = window.t(key);
        if (translated && translated !== key) return translated;
      }
    } catch (_) {}

    return (
      PANEL_DICTIONARY[lang]?.[key] ||
      PANEL_DICTIONARY.tr[key] ||
      key
    );
  }

  function showToast(type, message) {
    try {
      if (window.toast && typeof window.toast[type] === "function") {
        window.toast[type](message);
        return;
      }

      if (typeof window.toast === "function") {
        window.toast(message, type);
        return;
      }

      if (window.Toast && typeof window.Toast.show === "function") {
        window.Toast.show(message, type);
        return;
      }
    } catch (error) {
      console.warn("[cover.panel] toast failed", error);
    }

    if (type === "error") console.error("[cover.panel]", message);
    else console.log("[cover.panel]", message);
  }

  function toastSuccess(message) {
    showToast("success", message);
  }

  function toastError(message) {
    showToast("error", message);
  }

  function toastInfo(message) {
    showToast("info", message);
  }

  function waitForRightPanel(callback) {
    const startedAt = Date.now();

    const timer = setInterval(() => {
      const ready =
        window.RightPanel &&
        typeof window.RightPanel.register === "function" &&
        window.DBJobs &&
        typeof window.DBJobs.create === "function";

      if (ready) {
        clearInterval(timer);
        callback();
        return;
      }

      if (Date.now() - startedAt > 8000) {
        clearInterval(timer);
        console.warn("[cover.panel] RightPanel/DBJobs not ready after 8s");
      }
    }, 50);
  }

  function norm(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function escapeCssUrl(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, "");
  }

  function to2(value) {
    return String(Number(value) || 0).padStart(2, "0");
  }

  function parseTime(value) {
    if (value == null) return 0;
    if (typeof value === "number" && Number.isFinite(value)) return value;

    const text = String(value).trim();
    if (!text) return 0;

    if (/^\d{10,13}$/.test(text)) {
      const number = Number(text);
      return Number.isFinite(number) ? number : 0;
    }

    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(text) && !text.includes("T")) {
      const parsed = Date.parse(text.replace(" ", "T") + "Z");
      return Number.isFinite(parsed) ? parsed : 0;
    }

    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatDateTime(milliseconds) {
    const time = Number(milliseconds);
    if (!Number.isFinite(time) || time <= 0) return "";

    const date = new Date(time);

    return (
      `${to2(date.getDate())}.` +
      `${to2(date.getMonth() + 1)}.` +
      `${date.getFullYear()} ` +
      `${to2(date.getHours())}:` +
      `${to2(date.getMinutes())}`
    );
  }

  function isCoverApp(value) {
    const app = norm(value);
    return app === "cover" || app.includes("cover");
  }

  function getJobApp(job) {
    return String(
      job?.app ||
      job?.meta?.app ||
      job?.meta?.module ||
      job?.meta?.routeKey ||
      ""
    ).trim();
  }

  function getOutputApp(output) {
    return String(
      output?.meta?.app ||
      output?.meta?.module ||
      output?.meta?.routeKey ||
      ""
    ).trim();
  }

  function isCoverJob(job) {
    return isCoverApp(getJobApp(job));
  }

  function inferQuality(job) {
    return (
      job?.quality ||
      job?.meta?.quality ||
      job?.outputs?.[0]?.meta?.quality ||
      "artist"
    );
  }

  function qualityLabel(quality) {
    return String(quality || "").toLowerCase() === "ultra"
      ? "Cinematic Ultra HD"
      : "Artist";
  }

  function getCoverCardTitle(job) {
    const label = qualityLabel(inferQuality(job));

    const date = formatDateTime(
      parseTime(job?.created_at) ||
      parseTime(job?.updated_at) ||
      parseTime(job?.createdAt)
    );

    return date ? `${label} • ${date}` : label;
  }

  function getCoverCardPrompt(job) {
    return String(
      job?.prompt ||
      job?.meta?.prompt ||
      ""
    ).trim();
  }

  function buildCoverSearchHaystack(job) {
    return [
      getCoverCardTitle(job).toLowerCase(),
      getCoverCardPrompt(job).toLowerCase()
    ].filter(Boolean).join(" ");
  }

  function statusBadge(job) {
    const status = norm(
      job?.db_status ||
      job?.status ||
      job?.state ||
      ""
    ).toUpperCase();

    if (status.includes("FAIL") || status.includes("ERROR")) {
      return {
        text: panelText("studio.cover.panel.failed"),
        kind: "bad"
      };
    }

    if (
      status.includes("READY") ||
      status.includes("DONE") ||
      status.includes("COMPLET") ||
      status.includes("SUCC")
    ) {
      return {
        text: panelText("studio.cover.panel.ready"),
        kind: "ok"
      };
    }

    return {
      text: panelText("studio.cover.panel.processing"),
      kind: "mid"
    };
  }

  function pickBestImageOutput(job) {
    const outputs = Array.isArray(job?.outputs) ? job.outputs : [];
    if (!outputs.length) return null;

    const filtered = outputs.filter((output) => {
      const type = norm(
        output?.type ||
        output?.kind ||
        output?.meta?.type ||
        output?.meta?.kind
      );

      if (type && type !== "image") return false;

      const app = getOutputApp(output);
      if (app && !isCoverApp(app)) return false;

      return true;
    });

    const pool = filtered.length ? filtered : outputs;

    const selected =
      pool.find((output) => {
        const type = norm(
          output?.type ||
          output?.kind ||
          output?.meta?.type ||
          output?.meta?.kind
        );

        return type === "image";
      }) || pool[0];

    if (!selected) return null;

    const url = String(
      selected?.url ||
      selected?.image_url ||
      selected?.imageUrl ||
      selected?.raw_url ||
      selected?.rawUrl ||
      selected?.meta?.url ||
      selected?.meta?.image_url ||
      selected?.meta?.imageUrl ||
      ""
    ).trim();

    if (!url) return null;

    return {
      ...selected,
      url
    };
  }

  function ensureStyles() {
    if (document.getElementById("cpStyles")) return;

    const style = document.createElement("style");
    style.id = "cpStyles";
    style.textContent = `
      .cpGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .cpEmpty{opacity:.7;font-size:13px;padding:12px}
      .cpCard{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:18px;overflow:hidden;backdrop-filter:blur(10px)}
      .cpThumb{position:relative;aspect-ratio:1/1;background-size:cover;background-position:center;background-color:rgba(255,255,255,.04)}
      .cpThumb.is-loading{background:rgba(255,255,255,.04)}
      .cpBadge{position:absolute;top:10px;left:10px;font-size:12px;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.10);z-index:3}
      .cpBadge.ok{border-color:rgba(120,255,190,.22)}
      .cpBadge.mid{border-color:rgba(255,255,255,.10)}
      .cpBadge.bad{border-color:rgba(255,120,120,.25)}
      .cpSkel{position:absolute;inset:0;overflow:hidden}
      .cpShimmer{position:absolute;inset:-40%;transform:rotate(12deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);animation:cpShim 1.2s infinite}
      @keyframes cpShim{0%{transform:translateX(-40%) rotate(12deg)}100%{transform:translateX(40%) rotate(12deg)}}
      .cpOverlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);opacity:0;transition:opacity .18s ease;z-index:2}
      .cpCard:hover .cpOverlay{opacity:1}
      @media (hover:none){.cpOverlay{opacity:1;background:rgba(0,0,0,.18)}}
      .cpOverlayBtns{display:flex;gap:12px;padding:10px 12px;border-radius:18px;background:rgba(20,20,28,.35);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(10px)}
      .cpBtn{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);display:grid;place-items:center;cursor:pointer;transition:transform .12s ease,background .12s ease,border-color .12s ease}
      .cpBtn svg{width:22px;height:22px;opacity:.95}
      .cpBtn:hover{transform:translateY(-1px);background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.22)}
      .cpBtn:active{transform:translateY(0) scale(.98)}
      .cpBtn:disabled{opacity:.45;cursor:not-allowed}
      .cpBtn.danger{border-color:rgba(255,90,90,.28)}
      .cpBtn.danger:hover{background:rgba(255,90,90,.10);border-color:rgba(255,90,90,.35)}
      .cpBottom{padding:12px 12px 14px;display:flex;align-items:center;gap:10px}
      .cpName{font-size:12px;opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    `;

    document.head.appendChild(style);
  }

  function iconEye() {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.8"/><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" stroke-width="1.8"/></svg>`;
  }

  function iconDownload() {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7.5 10.8 12 15.3l4.5-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }

  function iconShare() {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 4l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M20 14v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }

  function iconTrash() {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 11v7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 11v7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 7l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }

  function normalizeDownloadUrl(url) {
    let cleanUrl = String(url || "").trim();
    if (!cleanUrl) return "";

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
      } catch (_) {}
    }

    return cleanUrl;
  }

  async function downloadCover(url) {
    const cleanUrl = normalizeDownloadUrl(url);
    if (!cleanUrl) return "failed";

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
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = "aivo-cover.jpg";
      anchor.rel = "noopener";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1500);

      return "downloaded";
    } catch (error) {
      console.error("[cover.panel] download failed", error);

      const opened = window.open(cleanUrl, "_blank", "noopener");
      return opened ? "opened" : "failed";
    }
  }

  async function shareCover(url) {
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return "shared";
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return "copied";
      }
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
      console.error("[cover.panel] share failed", error);
    }

    return "failed";
  }

  function findGrid(host) {
    return host?.querySelector("[data-cover-grid]") || null;
  }

  function render(host, items) {
    const grid = findGrid(host);
    if (!grid) return;

    const rawList = Array.isArray(items) ? items : [];
    const query = String(coverSearchQuery || "").trim().toLowerCase();

    const list = query
      ? rawList.filter((job) => buildCoverSearchHaystack(job).includes(query))
      : rawList;

    if (!list.length) {
      grid.innerHTML = `
        <div class="cpEmpty">
          ${escapeHtml(
            query
              ? panelText("studio.cover.panel.noResults")
              : panelText("studio.cover.panel.empty")
          )}
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map((job) => {
      const badge = statusBadge(job);
      const output = pickBestImageOutput(job);
      const url = output?.url || "";
      const ready = badge.kind === "ok" && Boolean(url);
      const name = getCoverCardTitle(job);
      const prompt = getCoverCardPrompt(job);
      const jobId = String(job?.job_id || job?.id || "");

      const thumbStyle = ready
        ? `style="background-image:url('${escapeCssUrl(url)}')"`
        : "";

      return `
        <div
          class="cpCard"
          data-id="${escapeHtml(jobId)}"
          tabindex="0"
        >
          <div class="cpThumb ${ready ? "" : "is-loading"}" ${thumbStyle}>
            <div class="cpBadge ${escapeHtml(badge.kind)}">
              ${escapeHtml(badge.text)}
            </div>

            ${ready ? "" : '<div class="cpSkel"><div class="cpShimmer"></div></div>'}

            <div class="cpOverlay" aria-hidden="${ready ? "false" : "true"}">
              <div class="cpOverlayBtns">
                <button
                  class="cpBtn"
                  type="button"
                  data-act="open"
                  title="${escapeHtml(panelText("studio.cover.panel.open"))}"
                  aria-label="${escapeHtml(panelText("studio.cover.panel.open"))}"
                  ${ready ? "" : "disabled"}
                >
                  ${iconEye()}
                </button>

                <button
                  class="cpBtn"
                  type="button"
                  data-act="download"
                  title="${escapeHtml(panelText("studio.cover.panel.download"))}"
                  aria-label="${escapeHtml(panelText("studio.cover.panel.download"))}"
                  ${ready ? "" : "disabled"}
                >
                  ${iconDownload()}
                </button>

                <button
                  class="cpBtn"
                  type="button"
                  data-act="share"
                  title="${escapeHtml(panelText("studio.cover.panel.share"))}"
                  aria-label="${escapeHtml(panelText("studio.cover.panel.share"))}"
                  ${ready ? "" : "disabled"}
                >
                  ${iconShare()}
                </button>

                <button
                  class="cpBtn danger"
                  type="button"
                  data-act="delete"
                  title="${escapeHtml(panelText("studio.cover.panel.delete"))}"
                  aria-label="${escapeHtml(panelText("studio.cover.panel.delete"))}"
                >
                  ${iconTrash()}
                </button>
              </div>
            </div>
          </div>

          <div class="cpBottom">
            <div class="cpName" title="${escapeHtml(prompt || name)}">
              ${escapeHtml(name)}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function translatedHeader() {
    return {
      title: panelText("studio.cover.panel.title"),
      meta: "",
      searchPlaceholder: panelText("studio.cover.panel.search")
    };
  }

  function refreshVisiblePanelLanguage() {
    if (!coverHost) return;

    const items = Array.isArray(coverHost.__coverItems)
      ? coverHost.__coverItems
      : [];

    render(coverHost, items);

    const wrap = coverHost.closest(".rpPanelWrap");
    const visible = wrap && wrap.style.display !== "none";

    if (!visible) return;

    const panelRoot = document.getElementById("rightPanelHost");
    const titleElement = panelRoot?.querySelector(".rpTitle");
    const searchElement = panelRoot?.querySelector(".rpSearch");

    if (titleElement) {
      titleElement.textContent = panelText("studio.cover.panel.title");
    }

    if (searchElement) {
      searchElement.placeholder = panelText("studio.cover.panel.search");
    }
  }

  async function deleteCover(jobId, host, controller) {
    try {
      const response = await fetch("/api/jobs/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          job_id: jobId
        })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "delete_failed");
      }

      hiddenDeletedIds.add(String(jobId));

      const currentItems = Array.isArray(controller?.state?.items)
        ? controller.state.items
        : [];

      const visibleItems = currentItems.filter((item) => {
        const id = String(item?.job_id || item?.id || "");
        return !hiddenDeletedIds.has(id);
      });

      host.__coverItems = visibleItems;
      render(host, visibleItems);

      try {
        controller?.hydrate?.();
      } catch (_) {}

      toastSuccess(panelText("studio.cover.panel.deleted"));
    } catch (error) {
      console.error("[cover.panel] delete failed", error);
      toastError(panelText("studio.cover.panel.deleteFailed"));
    }
  }

  function registerPanel() {
    registerDictionary();

    window.RightPanel.register(PANEL_KEY, {
      getHeader() {
        return translatedHeader();
      },

      onSearch(query) {
        coverSearchQuery = String(query || "").trim().toLowerCase();

        if (!coverHost) return;

        const items = Array.isArray(coverHost.__coverItems)
          ? coverHost.__coverItems
          : [];

        render(coverHost, items);
      },

      onShow(payload, context) {
        if (context?.setHeader) {
          context.setHeader(translatedHeader());
        }

        refreshVisiblePanelLanguage();
      },

      mount(host) {
        ensureStyles();
        coverHost = host;

        host.innerHTML = `
          <div class="coverSide">
            <div class="coverSideCard">
              <div class="cpGrid" data-cover-grid></div>
            </div>
          </div>
        `;

        host.__coverItems = [];

        const controller = window.DBJobs.create({
          app: "cover",
          debug: false,
          pollIntervalMs: 4000,
          hydrateEveryMs: 15000,

          acceptJob(job) {
            if (!job) return false;

            const app = getJobApp(job);
            if (app && !isCoverApp(app)) return false;

            return true;
          },

          acceptOutput(output) {
            if (!output) return false;

            const type = norm(
              output?.type ||
              output?.kind ||
              output?.meta?.type ||
              output?.meta?.kind
            );

            if (type && type !== "image") return false;

            const app = getOutputApp(output);
            if (app && !isCoverApp(app)) return false;

            return true;
          },

          onChange(items) {
            const safeItems = (items || [])
              .filter(isCoverJob)
              .filter((item) => {
                const id = String(item?.job_id || item?.id || "");
                return !hiddenDeletedIds.has(id);
              })
              .sort((first, second) => {
                const firstTime =
                  parseTime(first?.updated_at) ||
                  parseTime(first?.created_at) ||
                  parseTime(first?.createdAt) ||
                  0;

                const secondTime =
                  parseTime(second?.updated_at) ||
                  parseTime(second?.created_at) ||
                  parseTime(second?.createdAt) ||
                  0;

                if (secondTime !== firstTime) {
                  return secondTime - firstTime;
                }

                const firstId = String(first?.job_id || first?.id || "");
                const secondId = String(second?.job_id || second?.id || "");

                return secondId.localeCompare(firstId);
              });

            host.__coverItems = safeItems;
            render(host, safeItems);
          }
        });

        coverController = controller;

        try {
          controller?.hydrate?.();
        } catch (error) {
          console.warn("[cover.panel] initial hydrate failed", error);
        }

        const onCoverJobCreated = (event) => {
          const detail = event?.detail || {};

          if (!isCoverApp(detail.app || detail.meta?.app || "cover")) {
            return;
          }

          try {
            controller?.hydrate?.();
          } catch (error) {
            console.warn("[cover.panel] hydrate after job_created failed", error);
          }
        };

        const onClick = async (event) => {
          const button = event.target.closest("[data-act]");
          if (!button || button.disabled) return;

          const card = button.closest(".cpCard");
          if (!card) return;

          const jobId = String(card.getAttribute("data-id") || "");
          if (!jobId) return;

          const items = Array.isArray(controller?.state?.items)
            ? controller.state.items
            : [];

          const job = items.find((item) => {
            return String(item?.job_id || item?.id || "") === jobId;
          });

          if (!job) return;

          const action = button.getAttribute("data-act");
          const output = pickBestImageOutput(job);
          const url = output?.url || "";

          event.preventDefault();
          event.stopPropagation();

          if (action === "delete") {
            await deleteCover(jobId, host, controller);
            return;
          }

          if (!url) return;

          if (action === "open") {
            window.open(url, "_blank", "noopener");
            return;
          }

          if (action === "download") {
            button.disabled = true;

            try {
              const result = await downloadCover(url);

              if (result === "downloaded") {
                toastSuccess(panelText("studio.cover.panel.downloaded"));
              } else if (result === "opened") {
                toastInfo(panelText("studio.cover.panel.openedNewTab"));
              } else {
                toastError(panelText("studio.cover.panel.downloadFailed"));
              }
            } finally {
              button.disabled = false;
            }

            return;
          }

          if (action === "share") {
            const result = await shareCover(url);

            if (result === "shared") {
              toastSuccess(panelText("studio.cover.panel.shared"));
            } else if (result === "copied") {
              toastSuccess(panelText("studio.cover.panel.linkCopied"));
            } else if (result !== "cancelled") {
              toastError(panelText("studio.cover.panel.shareFailed"));
            }
          }
        };

        host.addEventListener("click", onClick, true);
        window.addEventListener("aivo:cover:job_created", onCoverJobCreated, true);

        return () => {
          try {
            host.removeEventListener("click", onClick, true);
          } catch (_) {}

          try {
            window.removeEventListener(
              "aivo:cover:job_created",
              onCoverJobCreated,
              true
            );
          } catch (_) {}

          try {
            controller?.destroy?.();
          } catch (_) {}

          if (coverController === controller) {
            coverController = null;
          }

          if (coverHost === host) {
            coverHost = null;
          }
        };
      }
    });
  }

  function refreshLanguage() {
    registerDictionary();
    refreshVisiblePanelLanguage();
  }

  document.addEventListener("aivo:language-change", refreshLanguage);
  document.addEventListener("aivo:studio:i18n-applied", refreshLanguage);

  registerDictionary();
  waitForRightPanel(registerPanel);
})();
