(function () {
  /********************************************************************
   * AIVO – music.module.js (FINAL FULL FILE)
   * - Basic/Advanced mode toggle (sessionStorage)
   * - Char counters (prompt/lyrics)
   * - Record modal (Suno-style): open → record → stop → preview → save
   * - Ref audio upload (R2)
   * - Assistant runtime publisher
   * - Card select / deselect publish
   * - Overflow menu open / close publish
   * - Modal context publish
   * - Generate start / ready / failed publish
   * - Delete / download / generic action publish
   ********************************************************************/

  /* =========================
   * Small helpers
   * ========================= */
  const MODE_KEY = "aivo_music_mode";

  function $(root, sel) { return root.querySelector(sel); }
  function $all(root, sel) { return Array.from(root.querySelectorAll(sel)); }

  function toast(msg, type = "info") {
    if (window.toast && typeof window.toast === "function") return window.toast(msg, type);
    if (window.Toast && typeof window.Toast.show === "function") return window.Toast.show(msg, type);
    console.log(`[toast:${type}]`, msg);
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function ensureHiddenRefUrlInput(module) {
    let el = module.querySelector("#refAudioUrl");
    if (!el) {
      el = document.createElement("input");
      el.type = "hidden";
      el.id = "refAudioUrl";
      el.name = "refAudioUrl";
      module.appendChild(el);
    }
    return el;
  }

  /* =========================
   * Assistant Runtime Publisher
   * ========================= */
   function getMusicAssistantModuleRoot() {
    return (
      document.querySelector("#moduleHost section[data-module='music']") ||
      document.querySelector(".rpShell") ||
      document.body
    );
  }

  function isElementActuallyVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (
      el.hidden ||
      el.getAttribute("aria-hidden") === "true" ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function normalizeMusicStatus(value) {
    const raw = String(value || "").toLowerCase().trim();
    if (!raw) return "";

    if (/(ready|completed|hazır|tamamlandı|complete|done)/.test(raw)) return "ready";
    if (/(processing|işleniyor|hazırlanıyor|rendering|loading|pending)/.test(raw)) return "processing";
    if (/(queued|sırada|queue)/.test(raw)) return "queued";
    if (/(failed|error|hata|başarısız)/.test(raw)) return "failed";
    if (/(deleted|silindi)/.test(raw)) return "deleted";

    return raw;
  }

function getMusicAssistantSelectedCard() {
  const selected =
    document.querySelector("#rightPanelHost .aivo-player-card[data-selected-music-card='true']") ||
    document.querySelector("#rightPanelHost .aivo-player-card.is-selected") ||
    document.querySelector('#rightPanelHost .aivo-player-card[aria-selected="true"]') ||
    document.querySelector(".aivo-player-card[data-selected-music-card='true']") ||
    document.querySelector(".aivo-player-card.is-selected") ||
    document.querySelector('.aivo-player-card[aria-selected="true"]') ||
    null;

  if (!selected) return null;

  const id =
    selected.getAttribute("data-id") ||
    selected.getAttribute("data-job-id") ||
    selected.getAttribute("data-card-id") ||
    "";

  const providerJobId =
    selected.getAttribute("data-provider-job-id") ||
    selected.getAttribute("data-provider-id") ||
    "";

  const titleEl =
    selected.querySelector(".aivo-player-title, .aivo-player-titleRow strong, .aivo-player-titleRow, [data-role='title']") ||
    null;

  const statusClass =
    Array.from(selected.classList).find((cls) => /^is-/.test(cls) && cls !== "is-selected") ||
    "";

  const statusEl =
    selected.querySelector(".aivo-player-status, .aivo-player-meta, [data-role='status']") ||
    null;

  const title = titleEl
    ? String(titleEl.textContent || "").trim().split("\n")[0].trim()
    : "";

  const statusFromDom = statusEl ? String(statusEl.textContent || "").trim() : "";
  const statusFromClass = statusClass ? statusClass.replace(/^is-/, "") : "";

  const status =
    selected.getAttribute("data-status") ||
    statusFromClass ||
    statusFromDom ||
    "";

  return {
    id,
    title,
    status: normalizeMusicStatus(status),
    rawStatus: status,
    providerJobId,
    element: selected
  };
}

    if (!selected) return null;

    const id =
      selected.getAttribute("data-id") ||
      selected.getAttribute("data-job-id") ||
      selected.getAttribute("data-card-id") ||
      "";

    const providerJobId =
      selected.getAttribute("data-provider-job-id") ||
      selected.getAttribute("data-provider-id") ||
      "";

    const titleEl =
      selected.querySelector(".aivo-player-title, .aivo-player-titleRow strong, .aivo-player-titleRow, [data-role='title']") ||
      null;

    const statusClass =
      Array.from(selected.classList).find((cls) => /^is-/.test(cls) && cls !== "is-selected") ||
      "";

    const statusEl =
      selected.querySelector(".aivo-player-status, .aivo-player-meta, [data-role='status']") ||
      null;

    const title = titleEl
      ? String(titleEl.textContent || "").trim().split("\n")[0].trim()
      : "";

    const statusFromDom = statusEl ? String(statusEl.textContent || "").trim() : "";
    const statusFromClass = statusClass ? statusClass.replace(/^is-/, "") : "";

    const status =
      selected.getAttribute("data-status") ||
      statusFromClass ||
      statusFromDom ||
      "";

    return {
      id,
      title,
      status: normalizeMusicStatus(status),
      rawStatus: status,
      providerJobId,
      element: selected
    };
  }
  function getMusicAssistantVisibleOverflowMenu() {
    const root = getMusicAssistantModuleRoot() || document;

    const selectors = [
      ".music-card-menu.is-open",
      ".music-overflow-menu.is-open",
      ".card-menu.is-open",
      ".dropdown-menu.is-open",
      ".menu-popover.is-open",
      ".popover.is-open",
      ".dropdown.open .dropdown-menu",
      ".menu.open",
      "[data-overflow-menu].is-open",
      "[data-menu-open='true']",
      "[role='menu']"
    ];

    for (const sel of selectors) {
      const list = Array.from(root.querySelectorAll(sel));
      const found = list.find((el) => isElementActuallyVisible(el));
      if (found) return found;
    }

    return null;
  }

  function getMusicAssistantVisibleModals() {
    const modals = [];
    const root = getMusicAssistantModuleRoot() || document;

    const candidates = Array.from(
      document.querySelectorAll(
        [
          ".modal",
          ".dialog",
          "[role='dialog']",
          ".sheet",
          ".drawer",
          ".aivoRecOverlay",
          ".aivoRecModal",
          "[data-modal]",
          "[data-dialog]",
          "[data-sheet]",
          "[data-drawer]",
          "[aria-modal='true']"
        ].join(",")
      )
    );

    const pushModal = (name) => {
      if (!name) return;
      modals.push(name);
    };

    candidates.forEach((el) => {
      if (!isElementActuallyVisible(el)) return;

      const isRecordModal =
        el.classList.contains("aivoRecOverlay") ||
        el.classList.contains("aivoRecModal");

      const insideMusic =
        isRecordModal ||
        !!el.closest("#moduleHost section[data-module='music']") ||
        !!root.querySelector(".aivoRecOverlay");

      if (!insideMusic) return;

      const text = String(el.innerText || "").toLowerCase();
      const modalId = String(
        el.getAttribute("data-modal") ||
        el.getAttribute("data-dialog") ||
        el.getAttribute("data-sheet") ||
        el.getAttribute("data-drawer") ||
        el.id ||
        ""
      ).toLowerCase();

      const classText = String(el.className || "").toLowerCase();
      const signature = `${modalId} ${classText} ${text}`;

      if (
        isRecordModal ||
        /record|kayit|kayıt|mikrofon|mic/.test(signature)
      ) {
        pushModal("music_record_modal_open");
        return;
      }

      if (
        /channel|stem|separate|separation/.test(signature) ||
        /kanal ayırma|kanallara ayır|vokal ayır|enstrüman ayır|stem/.test(signature)
      ) {
        pushModal("channel_separation_confirm");
        return;
      }

      if (
        /master|mastering/.test(signature) ||
        /mastering|master/.test(text)
      ) {
        pushModal("mastering_confirm");
        return;
      }
    });

    return Array.from(new Set(modals));
  }

  function getMusicAssistantAvailableActions() {
    const actions = [];
    const selectedCard = getMusicAssistantSelectedCard();
    const visibleModals = getMusicAssistantVisibleModals();
    const overflowMenu = getMusicAssistantVisibleOverflowMenu();
    const card = selectedCard?.element || null;
    const root = getMusicAssistantModuleRoot() || document;
    const generateBtn = root.querySelector("#musicGenerateBtn");

    if (generateBtn) {
      actions.push("generate_music");
    }

    if (selectedCard) {
      actions.push("select_card");
      actions.push("deselect_card");
    }

    if (root.querySelector("#musicRecordBtn")) {
      actions.push("open_record_modal");
    }

    if (card) {
      const cardText = String(card.innerText || "").toLowerCase();

      if (/indir|download/.test(cardText)) actions.push("download_music");
      if (/mastering/.test(cardText)) actions.push("mastering");
      if (/kanal ayırma|stem|vokal ayır|enstrüman ayır/.test(cardText)) actions.push("channel_separation");
      if (/sil|delete/.test(cardText)) actions.push("delete_music");
      if (/paylaş|share/.test(cardText)) actions.push("share_music");
      if (/export|dışa aktar/.test(cardText)) actions.push("export_music");
      if (/menü|menu|more|actions|işlemler/.test(cardText)) actions.push("open_card_menu");
    }

    if (overflowMenu) {
      const menuText = String(overflowMenu.innerText || "").toLowerCase();
      actions.push("close_card_menu");

      if (/kanal ayırma|stem|vokal ayır|enstrüman ayır/.test(menuText)) actions.push("channel_separation");
      if (/mastering/.test(menuText)) actions.push("mastering");
      if (/indir|download/.test(menuText)) actions.push("download_music");
      if (/sil|delete/.test(menuText)) actions.push("delete_music");
      if (/export|dışa aktar/.test(menuText)) actions.push("export_music");
    }

    if (visibleModals.includes("channel_separation_confirm")) {
      actions.push("confirm_channel_separation");
    }

    if (visibleModals.includes("mastering_confirm")) {
      actions.push("confirm_mastering");
    }

    if (visibleModals.includes("music_record_modal_open")) {
      actions.push("record_start", "record_stop", "record_save");
    }

    return Array.from(new Set(actions));
  }

  function getMusicAssistantCredits() {
    const bodyText = String(document.body?.innerText || "");
    const bodyMatch = bodyText.match(/kredi\s+(\d+)/i);

    if (bodyMatch && Number.isFinite(Number(bodyMatch[1]))) {
      return Number(bodyMatch[1]);
    }

    const topbarCandidates = Array.from(
      document.querySelectorAll("button, a, div, span")
    );

    for (const el of topbarCandidates) {
      const text = String(el.textContent || "").trim();
      const m = text.match(/^Kredi\s+(\d+)$/i);
      if (m && Number.isFinite(Number(m[1]))) {
        return Number(m[1]);
      }
    }

    const runtimeCredits =
      window.__AIVO_USER_CREDITS__ ??
      window.AIVO_USER_CREDITS ??
      window.__AIVO_CREDITS__ ??
      null;

    if (runtimeCredits != null && Number.isFinite(Number(runtimeCredits))) {
      return Number(runtimeCredits);
    }

    return null;
  }

  function getMusicAssistantCreditsNeeded() {
    const visibleModals = getMusicAssistantVisibleModals();
    if (visibleModals.includes("channel_separation_confirm")) return 5;

    const bodyText = String(document.body?.innerText || "");
    const confirmMatch = bodyText.match(/onayla\s*\(\s*(\d+)\s*kredi\s*\)/i);
    if (confirmMatch) return Number(confirmMatch[1]);

    return null;
  }

  function getMusicAssistantLastJobStatus() {
    const selectedCard = getMusicAssistantSelectedCard();
    if (selectedCard?.status) return selectedCard.status;

    const bodyText = String(document.body?.innerText || "");
    if (/hazır|tamamlandı|completed|ready/i.test(bodyText)) return "ready";
    if (/processing|hazırlanıyor|işleniyor|rendering|loading/i.test(bodyText)) return "processing";
    if (/queued|sırada/i.test(bodyText)) return "queued";
    if (/hata|başarısız|failed|error/i.test(bodyText)) return "failed";

    return "";
  }

  function getMusicAssistantActionContext() {
    const visibleModals = getMusicAssistantVisibleModals();
    const selectedCard = getMusicAssistantSelectedCard();
    const overflowMenu = getMusicAssistantVisibleOverflowMenu();

    if (visibleModals.includes("channel_separation_confirm")) {
      return "channel_separation_confirm";
    }

    if (visibleModals.includes("mastering_confirm")) {
      return "mastering_confirm";
    }

    if (visibleModals.includes("music_record_modal_open")) {
      return "music_record_modal_open";
    }

    if (overflowMenu) {
      return "music_card_menu_open";
    }

    if (selectedCard) {
      return "music_card_selected";
    }

    return "music_main";
  }

  function publishMusicAssistantContext(extra = {}) {
    const selectedCard = getMusicAssistantSelectedCard();
    const visibleModals = getMusicAssistantVisibleModals();
    const availableActions = getMusicAssistantAvailableActions();
    const lastJobStatus =
      extra.lastJobStatus
        ? normalizeMusicStatus(extra.lastJobStatus)
        : getMusicAssistantLastJobStatus();
    const userCredits = getMusicAssistantCredits();
    const creditsNeeded = getMusicAssistantCreditsNeeded();
    const actionContext = extra.actionContext || getMusicAssistantActionContext();

    const ctx = {
      module: "music",
      currentPanel: "music",
      currentCardType: selectedCard ? "music_card" : "",
      selectedItemType: selectedCard ? "music_track" : "",
      lastJobStatus,
      userCredits,
      creditsNeeded,
      hasSelection: !!selectedCard,
      availableActions,
      visibleModals,
      actionContext,
      uiState: {
        selectedCard: selectedCard
          ? {
              id: selectedCard.id || "",
              title: selectedCard.title || "",
              status: selectedCard.rawStatus || selectedCard.status || "",
              providerJobId: selectedCard.providerJobId || ""
            }
          : null,
        ...extra.uiState
      }
    };

    window.__AIVO_ASSISTANT_CONTEXT__ = ctx;
    return ctx;
  }

  window.publishMusicAssistantContext = publishMusicAssistantContext;

  function queueMusicAssistantPublish(extra = {}) {
    requestAnimationFrame(() => {
      publishMusicAssistantContext(extra);
    });
  }

  function bindMusicAssistantRuntimeHooks(module) {
    if (module.__aivoAssistantRuntimeHooksBound) return;
    module.__aivoAssistantRuntimeHooksBound = true;

    document.addEventListener("click", (e) => {
      const selectedCardBefore = getMusicAssistantSelectedCard();

      const card = e.target.closest(".aivo-player-card");

      const overflowTrigger = e.target.closest(
        ".music-card-more, .music-card-menu-trigger, .card-more-btn, .overflow-btn, .aivo-player-actions [aria-haspopup='menu'], .aivo-player-actions button[title='Daha Fazla'], .aivo-player-actions button"
      );

      const deleteAction = e.target.closest(
        ".delete-btn, .music-delete, [data-action='delete'], [data-delete-card], .aivo-player-actions .trash, .aivo-player-actions button[title='Sil']"
      );

      const downloadAction = e.target.closest(
        ".download-btn, .music-download, [data-action='download'], .aivo-player-actions button[title='İndir']"
      );

      const generateAction = e.target.closest(
        "#musicGenerateBtn, [data-action='generate_music'], .music-generate-btn"
      );

      const confirmChannelAction = e.target.closest(
        "[data-action='channel_separation'], [data-action='confirm_channel_separation'], .channel-separation-confirm, .stem-confirm"
      );

      const confirmMasteringAction = e.target.closest(
        "[data-action='mastering'], [data-action='confirm_mastering'], .mastering-confirm"
      );

      if (generateAction) {
        queueMusicAssistantPublish({
          actionContext: "music_main",
          lastJobStatus: "processing",
          uiState: { generatePending: true }
        });
        return;
      }

      if (confirmChannelAction) {
        queueMusicAssistantPublish({
          actionContext: "channel_separation_confirm",
          lastJobStatus: "processing",
          uiState: { secondaryAction: "channel_separation" }
        });
        return;
      }

      if (confirmMasteringAction) {
        queueMusicAssistantPublish({
          actionContext: "mastering_confirm",
          lastJobStatus: "processing",
          uiState: { secondaryAction: "mastering" }
        });
        return;
      }

      if (card && !overflowTrigger && !deleteAction && !downloadAction) {
        document.querySelectorAll(".aivo-player-card[data-selected-music-card='true'], .aivo-player-card.is-selected, .aivo-player-card[aria-selected='true']").forEach((el) => {
          el.removeAttribute("data-selected-music-card");
          el.classList.remove("is-selected");
          el.removeAttribute("aria-selected");
        });

        card.setAttribute("data-selected-music-card", "true");
        card.classList.add("is-selected");
        card.setAttribute("aria-selected", "true");

        queueMusicAssistantPublish({ actionContext: "music_card_selected" });
        return;
      }

      if (overflowTrigger) {
        setTimeout(() => {
          const menu = getMusicAssistantVisibleOverflowMenu();
          publishMusicAssistantContext({
            actionContext: menu ? "music_card_menu_open" : (selectedCardBefore ? "music_card_selected" : "music_main")
          });
        }, 0);
        return;
      }

      if (deleteAction) {
        setTimeout(() => {
          publishMusicAssistantContext({
            actionContext: "music_main",
            lastJobStatus: "deleted"
          });
        }, 0);
        return;
      }

      if (downloadAction) {
        setTimeout(() => {
          publishMusicAssistantContext({
            actionContext: selectedCardBefore ? "music_card_selected" : "music_main"
          });
        }, 0);
      }
    }, true);
    document.addEventListener("click", (e) => {
      const root = getMusicAssistantModuleRoot();
      if (!root) return;

      const insideMusic = root.contains(e.target);
      const insideRecordModal = !!e.target.closest(".aivoRecOverlay, .aivoRecModal");
      const insideAnyMenu = !!e.target.closest(
        ".music-card-menu, .music-overflow-menu, .card-menu, .dropdown-menu, .menu-popover, .popover, [role='menu']"
      );
      const isOverflowTrigger = !!e.target.closest(
        ".music-card-more, .music-card-menu-trigger, .card-more-btn, .overflow-btn, [data-overflow-trigger], [aria-haspopup='menu']"
      );

      if (!insideMusic && !insideRecordModal) {
        setTimeout(() => {
          publishMusicAssistantContext({ actionContext: "music_main" });
        }, 0);
        return;
      }

      if (insideMusic && !insideAnyMenu && !isOverflowTrigger) {
        setTimeout(() => {
          const menu = getMusicAssistantVisibleOverflowMenu();
          const selected = getMusicAssistantSelectedCard();
          publishMusicAssistantContext({
            actionContext: menu
              ? "music_card_menu_open"
              : (selected ? "music_card_selected" : "music_main")
          });
        }, 0);
      }
    }, true);

    const obs = new MutationObserver((mutations) => {
      let shouldPublish = false;
      let forcedStatus = "";

      for (const m of mutations) {
        if (m.type === "attributes") {
          const attr = m.attributeName || "";
          if (
            attr === "class" ||
            attr === "style" ||
            attr === "hidden" ||
            attr === "aria-hidden" ||
            attr === "aria-selected" ||
            attr === "data-status" ||
            attr === "data-menu-open" ||
            attr === "open"
          ) {
            shouldPublish = true;

            if (attr === "data-status" && m.target) {
              forcedStatus = normalizeMusicStatus(m.target.getAttribute("data-status") || "");
            }
            break;
          }
        }

        if (m.type === "childList") {
          shouldPublish = true;

          const text = String((m.target && m.target.textContent) || "").toLowerCase();
          if (/hazır|tamamlandı|completed|ready/.test(text)) forcedStatus = "ready";
          if (/processing|hazırlanıyor|işleniyor|rendering/.test(text)) forcedStatus = "processing";
          if (/hata|başarısız|failed|error/.test(text)) forcedStatus = "failed";
          break;
        }
      }

      if (shouldPublish) {
        queueMusicAssistantPublish(
          forcedStatus
            ? { lastJobStatus: forcedStatus }
            : {}
        );
      }
    });

    obs.observe(module, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "hidden",
        "aria-hidden",
        "aria-selected",
        "data-status",
        "data-menu-open",
        "open"
      ]
    });
  }

  /* =========================
   * Char counters
   * ========================= */
  function initMusicCharCounters(module) {
    const counters = module.querySelectorAll(".char-counter[data-counter-for]");
    if (!counters || !counters.length) return;

    const bindOne = (counterEl) => {
      const id = counterEl.getAttribute("data-counter-for");
      if (!id) return;

      const ta = module.querySelector(`#${CSS.escape(id)}`);
      if (!ta) return;

      const maxAttr = ta.getAttribute("maxlength");
      const max =
        (maxAttr && Number(maxAttr)) ||
        (id === "lyrics" ? 5000 : id === "prompt" ? 500 : 0);

      if (ta.__aivoCounterBound) return;
      ta.__aivoCounterBound = true;

      counterEl.setAttribute("aria-live", "polite");

      const render = () => {
        const len = (ta.value || "").length;
        counterEl.textContent = `${len} / ${max}`;
        const over = max > 0 && len > max;
        counterEl.style.color = over ? "#ff4d6d" : "";
        counterEl.style.fontWeight = over ? "700" : "";
      };

      ta.addEventListener("input", render);
      render();
    };

    counters.forEach(bindOne);
  }

  /* =========================
   * Record modal UI
   * ========================= */
  function buildRecordModal() {
    const overlay = document.createElement("div");
    overlay.className = "aivoRecOverlay";
    overlay.innerHTML = `
      <div class="aivoRecModal" role="dialog" aria-modal="true" aria-label="Ses Kaydı">
        <button class="aivoRecClose" type="button" aria-label="Kapat">×</button>

        <div class="aivoRecTop">
          <div class="aivoRecTimer" aria-live="polite">00:00</div>
        </div>

        <div class="aivoRecBody">
          <div class="aivoRecWaveHint">Kayıt için kırmızı düğmeye bas</div>
        </div>

        <div class="aivoRecFooter">
          <button class="aivoRecBtn" type="button" aria-label="Kayıt Başlat/Durdur">
            <span class="dot"></span>
          </button>

          <div class="aivoRecActions" style="display:none;">
            <audio class="aivoRecAudio" controls preload="metadata"></audio>
            <div class="aivoRecActionRow">
              <button class="aivoRecReset" type="button">Baştan</button>
              <button class="aivoRecSave" type="button">Kaydet</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      .aivoRecOverlay{
        position: fixed; inset: 0; z-index: 99999;
        display:flex; align-items:center; justify-content:center;
        background: rgba(0,0,0,.55);
        backdrop-filter: blur(10px);
      }
      .aivoRecModal{
        width: min(720px, calc(100vw - 32px));
        border-radius: 22px;
        background: rgba(24,24,30,.92);
        border: 1px solid rgba(255,255,255,.08);
        box-shadow: 0 30px 90px rgba(0,0,0,.6);
        overflow: hidden;
        position: relative;
      }
      .aivoRecClose{
        position:absolute; right:14px; top:12px;
        width: 34px; height: 34px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.06);
        color:#fff; font-size:20px; line-height:1;
        cursor:pointer;
      }
      .aivoRecTop{ padding: 18px 18px 10px; display:flex; justify-content:center; }
      .aivoRecTimer{ font-weight:700; letter-spacing:.12em; color: rgba(255,255,255,.9); }
      .aivoRecBody{
        height: 280px;
        display:flex; align-items:center; justify-content:center;
        color: rgba(255,255,255,.45);
        user-select:none;
      }
      .aivoRecFooter{ padding: 14px 18px 18px; }
      .aivoRecBtn{
        width: 84px; height: 84px; border-radius: 999px;
        border: none; cursor:pointer;
        background: #ff3b30;
        box-shadow: 0 10px 30px rgba(255,59,48,.35);
        display:flex; align-items:center; justify-content:center;
        margin: 0 auto;
      }
      .aivoRecBtn .dot{
        width: 22px; height: 22px; border-radius: 6px;
        background: rgba(0,0,0,.25);
      }
      .aivoRecBtn.isRecording{
        background: #ff3b30;
      }
      .aivoRecBtn.isRecording .dot{
        width: 22px; height: 22px; border-radius: 4px;
        background: rgba(0,0,0,.25);
      }
      .aivoRecActions{ margin-top: 14px; }
      .aivoRecAudio{ width: 100%; }
      .aivoRecActionRow{
        display:flex; gap: 10px; margin-top: 10px;
      }
      .aivoRecReset, .aivoRecSave{
        flex:1;
        height: 44px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.06);
        color: #fff;
        cursor: pointer;
        font-weight: 700;
      }
      .aivoRecSave{
        background: rgba(255,255,255,.92);
        color: #111;
        border-color: rgba(255,255,255,.92);
      }
    `;
    overlay.appendChild(style);

    return overlay;
  }

  async function presignAndUploadAudio(blob) {
    const filename = `record-${Date.now()}.webm`;
    const contentType = blob.type || "audio/webm";

    const r = await fetch(`/api/r2/presign-put?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j || j.ok === false || !j.upload_url || !j.public_url) {
      throw new Error(j?.error || "presign_failed");
    }

    const put = await fetch(j.upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob
    });

    if (!put.ok) throw new Error(`upload_failed_${put.status}`);
    return { public_url: j.public_url, filename, contentType };
  }

  function openRecordFlow(module) {
    if (document.querySelector(".aivoRecOverlay")) return;

    const overlay = buildRecordModal();
    document.body.appendChild(overlay);
    publishMusicAssistantContext({ actionContext: "music_record_modal_open" });

    const btnClose = overlay.querySelector(".aivoRecClose");
    const timerEl = overlay.querySelector(".aivoRecTimer");
    const recBtn = overlay.querySelector(".aivoRecBtn");
    const actions = overlay.querySelector(".aivoRecActions");
    const audioEl = overlay.querySelector(".aivoRecAudio");
    const btnReset = overlay.querySelector(".aivoRecReset");
    const btnSave = overlay.querySelector(".aivoRecSave");

    let stream = null;
    let recorder = null;
    let chunks = [];
    let startedAt = 0;
    let tick = null;
    let recordedBlob = null;
    let recordedUrl = null;

    function cleanupMedia() {
      try { if (tick) clearInterval(tick); } catch(e) {}
      tick = null;

      try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch(e) {}
      recorder = null;

      try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch(e) {}
      stream = null;

      chunks = [];
      startedAt = 0;

      try {
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      } catch(e) {}
      recordedUrl = null;
      recordedBlob = null;
    }

    function close() {
      cleanupMedia();
      overlay.remove();
      publishMusicAssistantContext({ actionContext: "music_main" });
    }

    function setTimer() {
      const sec = (Date.now() - startedAt) / 1000;
      timerEl.textContent = formatTime(sec);
    }

    btnClose.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    btnReset.addEventListener("click", () => {
      try {
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      } catch(e) {}
      recordedUrl = null;
      recordedBlob = null;
      audioEl.removeAttribute("src");
      actions.style.display = "none";
      recBtn.style.display = "";
      timerEl.textContent = "00:00";
      publishMusicAssistantContext({ actionContext: "music_record_modal_open" });
    });

    recBtn.addEventListener("click", async () => {
      if (recorder && recorder.state === "recording") {
        try { recorder.stop(); } catch(e) {}
        recBtn.classList.remove("isRecording");
        publishMusicAssistantContext({ actionContext: "music_record_modal_open" });
        return;
      }

      try {
        chunks = [];
        recordedBlob = null;
        recordedUrl = null;

        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size) chunks.push(ev.data);
        };

        recorder.onstop = () => {
          try { if (tick) clearInterval(tick); } catch(e) {}
          tick = null;

          try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch(e) {}
          stream = null;

          recordedBlob = new Blob(chunks, { type: "audio/webm" });
          recordedUrl = URL.createObjectURL(recordedBlob);

          audioEl.src = recordedUrl;
          actions.style.display = "";
          recBtn.style.display = "none";
          publishMusicAssistantContext({ actionContext: "music_record_modal_open" });
        };

        startedAt = Date.now();
        timerEl.textContent = "00:00";
        tick = setInterval(setTimer, 250);

        recBtn.classList.add("isRecording");
        recorder.start();
        publishMusicAssistantContext({
          actionContext: "music_record_modal_open",
          uiState: { recording: true },
          lastJobStatus: "processing"
        });
      } catch (err) {
        console.error("[AIVO] record start failed:", err);
        toast("Mikrofon izni gerekli. Tarayıcıdan izin ver.", "error");
        cleanupMedia();
        publishMusicAssistantContext({ actionContext: "music_record_modal_open" });
      }
    });

    btnSave.addEventListener("click", async () => {
      if (!recordedBlob) return;

      btnSave.disabled = true;
      btnSave.textContent = "Kaydediliyor...";

      try {
        const { public_url } = await presignAndUploadAudio(recordedBlob);

        const hidden = ensureHiddenRefUrlInput(module);
        hidden.value = public_url;

        const refLabel = module.querySelector(".form-field:has(#refAudio) label.upload-box");
        if (refLabel) {
          refLabel.classList.add("has-file");
          refLabel.innerHTML = `<strong>Kayıt hazır</strong><div style="opacity:.75; font-size:12px; margin-top:4px;">Ses kaydı yüklendi</div>`;
        }

        toast("Kayıt kaydedildi ✅", "success");
        publishMusicAssistantContext({
          actionContext: "music_record_modal_open",
          uiState: { recordedAudioUrl: public_url },
          lastJobStatus: "ready"
        });
        close();
      } catch (e) {
        console.error("[AIVO] record save failed:", e);
        toast("Kayıt kaydedilemedi. (upload/presign)", "error");
        btnSave.disabled = false;
        btnSave.textContent = "Kaydet";
        publishMusicAssistantContext({
          actionContext: "music_record_modal_open",
          lastJobStatus: "failed"
        });
      }
    });
  }

  /* =========================
   * Main init
   * ========================= */
  function tryInit() {
    const module = document.querySelector("#moduleHost section[data-module='music']");
    if (!module) return false;

    const switchEl = module.querySelector(".mode-toggle");
    if (!switchEl) return false;

    const modeButtons = Array.from(switchEl.querySelectorAll("[data-mode-button]"));
    const advFields = Array.from(module.querySelectorAll('[data-visible-in="advanced"]'));
    const HARD_BLOCK_TERMS = [
      "deepfake",
      "sesini kopyala",
      "voice clone",
      "dudak senkronu",
      "lip sync"
    ];

    const HARD_BLOCK_PATTERNS = [
      /\bgibi\b/i,
      /\btarzında\b/i,
      /\btarzinda\b/i,
      /\bstilinde\b/i,
      /\bin the style of\b/i,
      /\blike\b/i,
      /\bbirebir\b/i,
      /\baynısı\b/i,
      /\baynisi\b/i,
      /\bsesini taklit et\b/i,
      /\bvokalini taklit et\b/i,
      /\bmelodisini kullan\b/i,
      /\bnakaratini kullan\b/i,
      /\bsözlerini kullan\b/i,
      /\bsozlerini kullan\b/i,
      /\brezil\b/i,
      /\bdalga geç\b/i,
      /\bdalga gec\b/i,
      /\başağıla\b/i,
      /\basagila\b/i
    ];

    const PUBLIC_FIGURE_TERMS = [
      "recep tayyip erdogan",
      "recep tayyip erdoğan",
      "erdogan",
      "erdoğan",
      "kemal kilicdaroglu",
      "kemal kılıçdaroğlu",
      "kilicdaroglu",
      "kılıçdaroğlu",
      "ekrem imamoglu",
      "ekrem imamoğlu",
      "imamoglu",
      "imamoğlu",
      "mansur yavas",
      "mansur yavaş",
      "devlet bahceli",
      "devlet bahçeli",
      "bahceli",
      "bahçeli",
      "meral aksener",
      "meral akşener",
      "aksener",
      "akşener",
      "ozgur ozel",
      "özgür özel",
      "ozel",
      "özel",
      "selahattin demirtas",
      "selahattin demirtaş",
      "demirtas",
      "demirtaş",
      "umit ozdag",
      "ümit özdağ",
      "ozdag",
      "özdağ",
      "fatih erbakan",
      "temel karamollaoglu",
      "temel karamollaoğlu",
      "muharrem ince",
      "sinan ogan",
      "sinan oğan",
      "ali babacan",
      "ahmet davutoglu",
      "ahmet davutoğlu",
      "davutoglu",
      "davutoğlu",
      "hulusi akar",
      "hakan fidan",
      "mehmet simsek",
      "mehmet şimşek",
      "simsek",
      "şimşek",
      "suleyman soylu",
      "süleyman soylu",
      "soylu",
      "bekir bozdag",
      "bekir bozdağ",
      "bozdag",
      "bozdağ",
      "numan kurtulmus",
      "numan kurtulmuş",
      "kurtulmus",
      "kurtulmuş",
      "omer celik",
      "ömer çelik",
      "celik",
      "çelik",
      "binali yildirim",
      "binali yıldırım",
      "abdullah gul",
      "abdullah gül",
      "gul",
      "gül",
      "ahmet necdet sezer",
      "turgut ozal",
      "turgut özal",
      "ismet inonu",
      "ismet inönü",
      "inonu",
      "inönü",
      "mustafa kemal ataturk",
      "mustafa kemal atatürk",
      "ataturk",
      "atatürk",
      "kemal ataturk",
      "cumhurbaskani",
      "cumhurbaşkanı",
      "cumhurbaskani yardimcisi",
      "cumhurbaşkanı yardımcısı",
      "bakan",
      "milletvekili",
      "belediye baskani",
      "belediye başkanı",
      "vali",
      "kaymakam",
      "siyasetci",
      "siyasetçi",
      "politikaci",
      "politikacı",
      "kamu figuru",
      "kamu figürü",
      "devlet buyugu",
      "devlet büyüğü"
    ];

    const ARTIST_NAME_TERMS = [
      "tarkan",
      "sezen aksu",
      "ajda pekkan",
      "sertab erener",
      "mustafa sandal",
      "kenan dogulu",
      "kenan doğulu",
      "hande yener",
      "demet akalin",
      "demet akalın",
      "gülşen",
      "gulsen",
      "hadise",
      "aleyna tilki",
      "edis",
      "murat boz",
      "simge",
      "simge sagin",
      "simge sağın",
      "sila",
      "sıla",
      "sila gencoglu",
      "sıla gençoglu",
      "özcan deniz",
      "ozcan deniz",
      "ebru gundes",
      "ebru gündeş",
      "özgün",
      "ferhat gocer",
      "ferhat göçer",
      "gokhan turkmen",
      "gökhan türkmen",
      "bengu",
      "bengü",
      "ziynet sali",
      "zeynep bastik",
      "zeynep bastık",
      "mabel matiz",
      "yildiz tilbe",
      "yıldız tilbe",
      "sibel can",
      "linet",
      "duman",
      "mor ve otesi",
      "mor ve ötesi",
      "teoman",
      "oguzhan koc",
      "oğuzhan koç",
      "cem adrian",
      "ceylan ertem",
      "haluk levent",
      "levent yuksel",
      "levent yüksel",
      "baris manco",
      "barış manço",
      "mfö",
      "mfo",
      "athena",
      "manga",
      "sagopa kajmer",
      "ceza",
      "ezhel",
      "ben fero",
      "gazapizm",
      "lvbel c5",
      "uzi",
      "reckol",
      "cakal",
      "çakal",
      "semicenk",
      "canozan",
      "motive",
      "khontkar",
      "norm ender",
      "contra",
      "sansar salvo",
      "şam",
      "selda bagcan",
      "selda bağcan",
      "müslüm gürses",
      "muslum gurses",
      "ibrahim tatlises",
      "ibrahim tatlıses",
      "orhan gencebay",
      "ferdi tayfur",
      "volkan konak",
      "candan ercetin",
      "nazan oncel",
      "nazan öncel",
      "fatma teyze",
      "yesim salkim",
      "yeşim salkım",
      "buray",
      "irem derici",
      "melek mosso",
      "koray avci",
      "koray avcı",
      "madrigal",
      "dedubluman",
      "yalin",
      "yalın",
      "emre aydin",
      "emre aydın",
      "mabel",
      "sefo",
      "fero",
      "sertab"
    ];

    function normalizePolicyText(value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function ensureMusicPolicyNote(generateBtn) {
      let policyNote = module.querySelector("#musicPolicyNote");
      if (!policyNote && generateBtn && generateBtn.parentElement) {
        policyNote = document.createElement("div");
        policyNote.id = "musicPolicyNote";
        policyNote.style.display = "none";
        policyNote.style.marginTop = "10px";
        policyNote.style.padding = "10px 12px";
        policyNote.style.borderRadius = "12px";
        policyNote.style.fontSize = "13px";
        policyNote.style.lineHeight = "1.4";
        policyNote.style.background = "rgba(255,77,109,.12)";
        policyNote.style.border = "1px solid rgba(255,77,109,.35)";
        policyNote.style.color = "#ff8aa0";
        generateBtn.parentElement.appendChild(policyNote);
      }
      return policyNote;
    }

    function evaluateMusicPolicyUI() {
      const generateBtn = module.querySelector("#musicGenerateBtn");
      const promptEl = module.querySelector("#prompt");
      const lyricsEl = module.querySelector("#lyrics");
      const policyNote = ensureMusicPolicyNote(generateBtn);

      if (!generateBtn) return false;

      const raw = [
        String(promptEl?.value || "").trim(),
        String(lyricsEl?.value || "").trim()
      ].filter(Boolean).join(" ");

      const text = normalizePolicyText(raw);

      const hasBlockedTerm =
        HARD_BLOCK_TERMS.some((term) => text.includes(normalizePolicyText(term))) ||
        PUBLIC_FIGURE_TERMS.some((term) => text.includes(normalizePolicyText(term))) ||
        ARTIST_NAME_TERMS.some((term) => text.includes(normalizePolicyText(term)));

      const hasBlockedPattern = HARD_BLOCK_PATTERNS.some((rx) => rx.test(raw));
      const blocked = !!raw && (hasBlockedTerm || hasBlockedPattern);

      generateBtn.disabled = blocked;
      generateBtn.style.opacity = blocked ? "0.55" : "";
      generateBtn.style.cursor = blocked ? "not-allowed" : "";

      generateBtn.style.background = blocked
        ? "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))"
        : "";
      generateBtn.style.borderColor = blocked
        ? "rgba(255,110,140,.95)"
        : "";
      generateBtn.style.boxShadow = blocked
        ? "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)"
        : "";
      generateBtn.style.opacity = "1";
      generateBtn.style.cursor = blocked ? "not-allowed" : "";
      generateBtn.style.transform = "";
      generateBtn.style.filter = blocked ? "saturate(1.05)" : "";

      if (policyNote) {
        if (blocked) {
          policyNote.style.display = "block";
          policyNote.style.marginTop = "12px";
          policyNote.style.padding = "12px 14px";
          policyNote.style.borderRadius = "16px";
          policyNote.style.background = "rgba(255,90,120,.10)";
          policyNote.style.border = "1px solid rgba(255,120,150,.24)";
          policyNote.style.color = "rgba(255,210,220,.96)";
          policyNote.style.fontSize = "14px";
          policyNote.style.fontWeight = "700";
          policyNote.style.lineHeight = "1.6";
          policyNote.style.textAlign = "center";
          policyNote.style.letterSpacing = ".01em";
          policyNote.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.04)";
          policyNote.style.backdropFilter = "blur(10px)";
          policyNote.style.webkitBackdropFilter = "blur(10px)";
          policyNote.style.position = "relative";
          policyNote.style.overflow = "hidden";
          policyNote.style.animation = "aivoPolicyPulse 1.8s ease-in-out infinite";
          policyNote.style.backgroundImage = "linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.10) 35%, rgba(255,255,255,0) 70%)";
          policyNote.style.backgroundSize = "220% 100%";
          policyNote.style.backgroundPosition = "200% 0";
          policyNote.textContent =
            "Bu istek bu haliyle üretilemez. Sanatçı adı yerine tür, duygu ve genel vokal karakteri yaz.";
        } else {
          policyNote.style.display = "none";
          policyNote.textContent = "";
        }
      }

      return blocked;
    }

    function bindMusicPolicyUI() {
      const generateBtn = module.querySelector("#musicGenerateBtn");
      const promptEl = module.querySelector("#prompt");
      const lyricsEl = module.querySelector("#lyrics");

      if (!generateBtn || generateBtn.__aivoPolicyClickBound) return;

      generateBtn.__aivoPolicyClickBound = true;

      const resetPolicyUI = () => {
        const policyNote = module.querySelector("#musicPolicyNote");

        if (promptEl) {
          promptEl.style.borderColor = "";
          promptEl.style.boxShadow = "";
          promptEl.style.animation = "";
        }

        if (lyricsEl) {
          lyricsEl.style.borderColor = "";
          lyricsEl.style.boxShadow = "";
          lyricsEl.style.animation = "";
        }

        generateBtn.style.background = "";
        generateBtn.style.borderColor = "";
        generateBtn.style.boxShadow = "";
        generateBtn.style.opacity = "";
        generateBtn.style.cursor = "";
        generateBtn.style.filter = "";
        generateBtn.style.animation = "";

        if (policyNote) {
          policyNote.style.display = "none";
          policyNote.textContent = "";
          policyNote.innerHTML = "";
          policyNote.style.animation = "";
        }
      };

      if (promptEl && !promptEl.__aivoPolicyResetBound) {
        promptEl.__aivoPolicyResetBound = true;
        promptEl.addEventListener("input", resetPolicyUI);
      }

      if (lyricsEl && !lyricsEl.__aivoPolicyResetBound) {
        lyricsEl.__aivoPolicyResetBound = true;
        lyricsEl.addEventListener("input", resetPolicyUI);
      }

      generateBtn.addEventListener("click", (e) => {
        resetPolicyUI();

        const raw = [
          String(promptEl?.value || "").trim(),
          String(lyricsEl?.value || "").trim()
        ].filter(Boolean).join(" ");

        const text = normalizePolicyText(raw);

        const hasBlockedTerm =
          HARD_BLOCK_TERMS.some((term) => text.includes(normalizePolicyText(term))) ||
          PUBLIC_FIGURE_TERMS.some((term) => text.includes(normalizePolicyText(term))) ||
          ARTIST_NAME_TERMS.some((term) => text.includes(normalizePolicyText(term)));

        const hasBlockedPattern = HARD_BLOCK_PATTERNS.some((rx) => rx.test(raw));
        const blocked = !!raw && (hasBlockedTerm || hasBlockedPattern);

        if (!blocked) {
          publishMusicAssistantContext({
            actionContext: "music_main",
            lastJobStatus: "processing",
            uiState: { generatePending: true }
          });
          return;
        }

        const policyNote = ensureMusicPolicyNote(generateBtn);

        e.preventDefault();
        e.stopPropagation();

        if (promptEl) {
          promptEl.style.borderColor = "rgba(255,110,140,.92)";
          promptEl.style.boxShadow = "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
          promptEl.style.animation = "aivoPolicyPulse 1.8s ease-in-out infinite";
        }

        if (lyricsEl) {
          lyricsEl.style.borderColor = "rgba(255,110,140,.92)";
          lyricsEl.style.boxShadow = "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
          lyricsEl.style.animation = "aivoPolicyPulse 1.8s ease-in-out infinite";
        }

        generateBtn.style.background = "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))";
        generateBtn.style.borderColor = "rgba(255,110,140,.95)";
        generateBtn.style.boxShadow = "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)";
        generateBtn.style.opacity = "1";
        generateBtn.style.cursor = "not-allowed";
        generateBtn.style.transform = "";
        generateBtn.style.filter = "saturate(1.05)";
        generateBtn.style.animation = "aivoPolicyPulse 1.8s ease-in-out infinite";

        if (policyNote) {
          policyNote.style.display = "block";
          policyNote.style.marginTop = "12px";
          policyNote.style.padding = "14px 16px";
          policyNote.style.borderRadius = "18px";
          policyNote.style.background = "rgba(255,90,120,.10)";
          policyNote.style.border = "1px solid rgba(255,120,150,.24)";
          policyNote.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.04)";
          policyNote.style.backdropFilter = "blur(10px)";
          policyNote.style.webkitBackdropFilter = "blur(10px)";
          policyNote.style.position = "relative";
          policyNote.style.overflow = "hidden";
          policyNote.style.textAlign = "center";
          policyNote.style.animation = "aivoPolicyPulse 1.8s ease-in-out infinite";

          policyNote.innerHTML = `
            <span style="
              display:inline-block;
              white-space:nowrap;
              width:100%;
              margin:0;
              padding:0;
              border:none;
              outline:none;
              box-shadow:none;
              background:none;
              text-align:center;
              font-size:14px;
              font-weight:800;
              line-height:1.65;
              letter-spacing:.01em;
              color:rgba(255,245,248,.96);
              text-shadow:0 0 10px rgba(255,255,255,.10), 0 0 22px rgba(255,120,150,.18);
              animation:aivoPolicyTextGlow 1.8s ease-in-out infinite;
            ">Bu istek bu haliyle üretilemez. Sanatçı adı yerine tür, duygu ve genel vokal karakteri yaz.</span>
          `;
        }

        publishMusicAssistantContext({
          actionContext: "music_main",
          uiState: { policyBlocked: true },
          lastJobStatus: "failed"
        });
      }, true);
    }

    if (!document.getElementById("aivoPolicyPulseStyle")) {
      const style = document.createElement("style");
      style.id = "aivoPolicyPulseStyle";
      style.textContent = `
        @keyframes aivoPolicyPulse {
          0% {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.04),
              0 0 0 1px rgba(255,120,150,.18),
              0 8px 24px rgba(255,70,110,.10);
          }
          50% {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.05),
              0 0 0 1px rgba(255,120,150,.30),
              0 12px 34px rgba(255,70,110,.18);
          }
          100% {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.04),
              0 0 0 1px rgba(255,120,150,.18),
              0 8px 24px rgba(255,70,110,.10);
          }
        }
        @keyframes aivoPolicyTextGlow {
          0% {
            opacity: .88;
            text-shadow: 0 0 8px rgba(255,255,255,.08), 0 0 18px rgba(255,120,150,.12);
          }
          50% {
            opacity: 1;
            text-shadow: 0 0 14px rgba(255,255,255,.16), 0 0 28px rgba(255,120,150,.24);
          }
          100% {
            opacity: .88;
            text-shadow: 0 0 8px rgba(255,255,255,.08), 0 0 18px rgba(255,120,150,.12);
          }
        }
      `;
      document.head.appendChild(style);
    }

    function applyMode(mode) {
      const m = (mode === "advanced") ? "advanced" : "basic";
      const viewEl = module.querySelector('.music-view[data-music-view="geleneksel"]');
      const generateBtn = module.querySelector('#musicGenerateBtn');
      const generateCard = generateBtn ? generateBtn.closest('.card') : null;

      module.setAttribute("data-mode", m);
      if (viewEl) viewEl.setAttribute("data-mode", m);

      switchEl.dataset.active = m;
      try { sessionStorage.setItem(MODE_KEY, m); } catch(e) {}

      modeButtons.forEach((btn) => {
        const on = btn.dataset.modeButton === m;
        btn.classList.toggle("isActive", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });

      const showAdv = (m === "advanced");
      advFields.forEach((el) => {
        el.style.display = showAdv ? "" : "none";
      });

      if (viewEl) {
        viewEl.style.paddingBottom = showAdv ? "120px" : "0px";
      }

      if (generateCard) {
        if (showAdv) {
          generateCard.style.position = "sticky";
          generateCard.style.bottom = "0px";
          generateCard.style.zIndex = "8";
          generateCard.style.marginTop = "10px";
          generateCard.style.padding = "16px 18px calc(16px + env(safe-area-inset-bottom))";
          generateCard.style.border = "1px solid rgba(255,255,255,.08)";
          generateCard.style.borderRadius = "24px";
          generateCard.style.background =
            "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01)), linear-gradient(180deg, rgba(12,10,34,.94), rgba(8,8,24,.96))";
          generateCard.style.backdropFilter = "blur(12px)";
          generateCard.style.webkitBackdropFilter = "blur(12px)";
          generateCard.style.boxShadow =
            "0 -10px 30px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04)";
        } else {
          generateCard.style.position = "";
          generateCard.style.bottom = "";
          generateCard.style.zIndex = "";
          generateCard.style.marginTop = "";
          generateCard.style.padding = "";
          generateCard.style.border = "";
          generateCard.style.borderRadius = "";
          generateCard.style.background = "";
          generateCard.style.backdropFilter = "";
          generateCard.style.webkitBackdropFilter = "";
          generateCard.style.boxShadow = "";
        }
      }

      if (generateBtn) {
        if (showAdv) {
          generateBtn.style.minHeight = "64px";
          generateBtn.style.borderRadius = "999px";
        } else {
          generateBtn.style.minHeight = "";
          generateBtn.style.borderRadius = "";
        }
      }

      publishMusicAssistantContext({
        actionContext: "music_main",
        uiState: { mode: m }
      });
    }

    let saved = "basic";
    try { saved = sessionStorage.getItem(MODE_KEY) || "basic"; } catch(e) {}
    applyMode(saved);

    if (!module.__aivo_mode_bound) {
      module.__aivo_mode_bound = true;
      module.addEventListener("click", (e) => {
        const btn = e.target.closest(".mode-toggle [data-mode-button]");
        if (!btn) return;
        applyMode(btn.dataset.modeButton);
      });
    }

    initMusicCharCounters(module);
    bindMusicPolicyUI();
    bindMusicAssistantRuntimeHooks(module);

    if (!module.__aivo_record_bound) {
      module.__aivo_record_bound = true;
      module.addEventListener("click", (e) => {
        const recBtn = e.target.closest("#musicRecordBtn");
        if (!recBtn) return;

        const mode = module.getAttribute("data-mode") || "basic";
        if (mode !== "advanced") return;

        openRecordFlow(module);
      });
    }

    if (!module.__aivoGenerateStateBound) {
      module.__aivoGenerateStateBound = true;

      const generateBtn = module.querySelector("#musicGenerateBtn");
      if (generateBtn) {
        generateBtn.addEventListener("click", () => {
          requestAnimationFrame(() => {
            if (!generateBtn.disabled) {
              publishMusicAssistantContext({
                actionContext: "music_main",
                lastJobStatus: "processing",
                uiState: { generatePending: true }
              });
            }
          });
        });
      }
    }

    window.switchMusicView = function () { return true; };

    publishMusicAssistantContext({ actionContext: "music_main" });

    console.log("[AIVO] music.module READY (final publisher integrated)");
    return true;
  }

  tryInit();

  const obs = new MutationObserver(() => {
    tryInit();
  });

  obs.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ============================================================================
   MUSIC — Reference Audio Upload (R2) ✅ single-bind + single-upload
   ============================================================================ */
(() => {
  if (window.__MUSIC_REF_AUDIO_UPLOAD_BIND__) return;
  window.__MUSIC_REF_AUDIO_UPLOAD_BIND__ = true;

  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function setHint(text) {
    const box = qs('label.upload-box[for="refAudio"]');
    if (!box) return;

    const hints = qsa(".upload-hint", box);
    if (!hints.length) return;

    hints[0].textContent = String(text || "");
    for (let i = 1; i < hints.length; i++) hints[i].textContent = "";
  }

  function toast(type, msg) {
    try {
      const t = window.toast;
      if (type === "error"   && t?.error)   return t.error(msg);
      if (type === "success" && t?.success) return t.success(msg);
      if (t?.info) return t.info(msg);
    } catch {}
    console.log("[music.ref]", type, msg);
  }

  function fileSig(file) {
    if (!file) return "";
    return [file.name, file.size, file.lastModified].join("|");
  }

  async function presignR2({ app, kind, filename, contentType, signal }) {
    const res = await fetch("/api/r2/presign-put", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal,
      body: JSON.stringify({
        app: app || "music",
        kind,
        filename,
        contentType,
      }),
    });

    if (!res.ok) throw new Error("presign_failed");
    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data?.error || "presign_error");

    const uploadUrl = data.uploadUrl || data.upload_url;
    const publicUrl = data.publicUrl || data.public_url || data.url;
    if (!uploadUrl || !publicUrl) throw new Error("presign_missing_urls");

    return { uploadUrl, publicUrl };
  }

  async function uploadToR2(file, { app = "music", kind = "audio", signal } = {}) {
    if (!file) throw new Error("missing_file");

    const contentType = file.type || "application/octet-stream";
    const filename = file.name || `${kind}-${Date.now()}`;

    const { uploadUrl, publicUrl } = await presignR2({
      app,
      kind,
      filename,
      contentType,
      signal,
    });

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
      signal,
    });

    if (!put.ok) throw new Error("r2_put_failed");
    return { url: publicUrl, name: filename };
  }

  let lastSig = "";
  let inFlight = null;

  function bindOnce() {
    const input = qs("#refAudio");
    if (!input) return false;

    if (input.__aivoRefBound) return true;
    input.__aivoRefBound = true;

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;

      if (!file) {
        try { inFlight?.controller?.abort?.(); } catch {}
        inFlight = null;
        lastSig = "";

        try { window.__MUSIC_REF_AUDIO_URL__ = ""; } catch {}
        setHint("MP3, WAV, M4A — maksimum 10MB");
        if (typeof window.publishMusicAssistantContext === "function") {
          window.publishMusicAssistantContext({ actionContext: "music_main" });
        }
        return;
      }

      const MAX = 10 * 1024 * 1024;
      if (file.size > MAX) {
        toast("error", "Maksimum 10MB");
        try { input.value = ""; } catch {}
        try { window.__MUSIC_REF_AUDIO_URL__ = ""; } catch {}
        setHint("MP3, WAV, M4A — maksimum 10MB");
        if (typeof window.publishMusicAssistantContext === "function") {
          window.publishMusicAssistantContext({
            actionContext: "music_main",
            lastJobStatus: "failed"
          });
        }
        return;
      }

      const sig = fileSig(file);
      if (sig && sig === lastSig && window.__MUSIC_REF_AUDIO_URL__) {
        setHint("Hazır ✓");
        if (typeof window.publishMusicAssistantContext === "function") {
          window.publishMusicAssistantContext({
            actionContext: "music_main",
            lastJobStatus: "ready"
          });
        }
        return;
      }

      try { inFlight?.controller?.abort?.(); } catch {}
      inFlight = null;

      const controller = new AbortController();
      inFlight = { controller, sig };

      setHint("Yükleniyor…");
      input.disabled = true;

      if (typeof window.publishMusicAssistantContext === "function") {
        window.publishMusicAssistantContext({
          actionContext: "music_main",
          lastJobStatus: "processing",
          uiState: { refAudioUploading: true }
        });
      }

      try {
        const out = await uploadToR2(file, {
          app: "music",
          kind: "audio",
          signal: controller.signal,
        });

        if (!inFlight || inFlight.controller !== controller) return;

        window.__MUSIC_REF_AUDIO_URL__ = out.url;
        lastSig = sig;

        setHint("Hazır ✓");
        toast("success", "Referans ses yüklendi");
        if (typeof window.publishMusicAssistantContext === "function") {
          window.publishMusicAssistantContext({
            actionContext: "music_main",
            lastJobStatus: "ready",
            uiState: { refAudioUrl: out.url }
          });
        }
      } catch (err) {
        if (err?.name === "AbortError") return;

        console.error("[MUSIC][R2] ref audio upload error:", err);
        try { window.__MUSIC_REF_AUDIO_URL__ = ""; } catch {}
        lastSig = "";
        setHint("Yükleme hatası");
        toast("error", "Yükleme hatası");
        if (typeof window.publishMusicAssistantContext === "function") {
          window.publishMusicAssistantContext({
            actionContext: "music_main",
            lastJobStatus: "failed"
          });
        }
      } finally {
        if (inFlight && inFlight.controller === controller) inFlight = null;
        input.disabled = false;
      }
    });

    return true;
  }

  bindOnce();
  setTimeout(bindOnce, 250);
  setTimeout(bindOnce, 800);
  setTimeout(bindOnce, 1600);
})();
