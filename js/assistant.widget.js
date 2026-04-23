(function () {
  if (window.__AIVO_ASSISTANT_WIDGET__) return;
  window.__AIVO_ASSISTANT_WIDGET__ = true;

  const STYLE_ID = "aivo-assistant-widget-style";

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .aivo-assistant-launcher {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 9999;
        border: 1px solid rgba(255,255,255,.14);
        background: linear-gradient(135deg, #7c4dff 0%, #ff4fa3 100%);
        color: #fff;
        border-radius: 999px;
        padding: 12px 18px;
        font: 700 13px/1 Inter, Arial, sans-serif;
        box-shadow: 0 10px 26px rgba(0,0,0,.30);
        cursor: pointer;
        transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
      }

      .aivo-assistant-launcher:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 34px rgba(0,0,0,.36);
      }

      .aivo-assistant-panel {
        position: fixed;
        right: 18px;
        bottom: 74px;
        z-index: 9999;
        width: 350px;
        max-width: calc(100vw - 24px);
        height: 520px;
        max-height: calc(100vh - 110px);
        display: none;
        flex-direction: column;
        overflow: hidden;
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,.10);
        background:
          radial-gradient(circle at top left, rgba(124,77,255,.16), transparent 34%),
          radial-gradient(circle at top right, rgba(255,79,163,.14), transparent 28%),
          rgba(8,8,16,.97);
        box-shadow: 0 18px 54px rgba(0,0,0,.44);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }

      .aivo-assistant-panel.is-open {
        display: flex;
      }

      .aivo-assistant-header {
        padding: 14px 14px 12px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      .aivo-assistant-title-wrap {
        min-width: 0;
      }

      .aivo-assistant-title {
        margin: 0;
        color: #fff;
        font: 800 15px/1.2 Inter, Arial, sans-serif;
        letter-spacing: -.01em;
      }

      .aivo-assistant-subtitle {
        margin: 5px 0 0;
        color: rgba(255,255,255,.58);
        font: 400 11px/1.35 Inter, Arial, sans-serif;
      }

      .aivo-assistant-close {
        border: 0;
        background: rgba(255,255,255,.07);
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        flex: 0 0 auto;
      }

      .aivo-assistant-quick {
        padding: 10px 12px 0;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .aivo-assistant-chip {
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.05);
        color: #fff;
        border-radius: 999px;
        padding: 8px 11px;
        cursor: pointer;
        font: 600 11px/1.1 Inter, Arial, sans-serif;
        transition: background .16s ease, border-color .16s ease, transform .16s ease;
      }

      .aivo-assistant-chip:hover {
        background: rgba(255,255,255,.08);
        border-color: rgba(255,255,255,.14);
        transform: translateY(-1px);
      }

      .aivo-assistant-messages {
        flex: 1;
        overflow: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .aivo-assistant-message {
        max-width: 86%;
        padding: 10px 11px;
        border-radius: 15px;
        white-space: pre-wrap;
        word-break: break-word;
        font: 400 13px/1.5 Inter, Arial, sans-serif;
      }

      .aivo-assistant-message.user {
        align-self: flex-end;
        background: linear-gradient(135deg, #7c4dff 0%, #ff4fa3 100%);
        color: #fff;
        border-bottom-right-radius: 6px;
      }

      .aivo-assistant-message.assistant {
        align-self: flex-start;
        background: rgba(255,255,255,.07);
        color: #f5f7ff;
        border: 1px solid rgba(255,255,255,.05);
        border-bottom-left-radius: 6px;
      }

      .aivo-assistant-message.system {
        align-self: center;
        background: transparent;
        color: rgba(255,255,255,.52);
        font-size: 11px;
        padding: 2px 8px;
      }

      .aivo-assistant-form {
        padding: 12px;
        border-top: 1px solid rgba(255,255,255,.08);
        display: flex;
     align-items: center;
        gap: 8px;
      }

      .aivo-assistant-input {
        flex: 1;
        min-width: 0;
        resize: none;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.05);
        color: #fff;
        border-radius: 16px;
        padding: 11px 13px;
        outline: none;
        min-height: 44px;
        max-height: 104px;
        font: 400 13px/1.4 Inter, Arial, sans-serif;
      }

      .aivo-assistant-input::placeholder {
        color: rgba(255,255,255,.36);
      }

      .aivo-assistant-send {
        border: 0;
        min-width: 86px;
        height: 44px;
        border-radius: 16px;
        background: linear-gradient(135deg, #7c4dff 0%, #ff4fa3 100%);
        color: #fff;
        padding: 0 15px;
        font: 800 13px/1 Inter, Arial, sans-serif;
        cursor: pointer;
        flex: 0 0 auto;
      }

      .aivo-assistant-send[disabled],
      .aivo-assistant-input[disabled] {
        opacity: .6;
        cursor: not-allowed;
      }

      @media (max-width: 640px) {
        .aivo-assistant-panel {
          right: 12px;
          left: 12px;
          bottom: 74px;
          width: auto;
          max-width: none;
          height: 68vh;
        }

        .aivo-assistant-launcher {
          right: 12px;
          bottom: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const state = {
    open: false,
    loading: false,
    messages: [
      {
        role: "assistant",
        content:
          "Merhaba, modüller, paket seçimi, kredi sistemi, prompt yazımı ve kullanım sorunlarında yardımcı olabilirim. Ne yapmak istiyorsun?"
      }
    ]
  };

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "aivo-assistant-launcher";
  launcher.textContent = "AI Yardım";

  const panel = document.createElement("section");
  panel.className = "aivo-assistant-panel";
  panel.innerHTML = `
    <div class="aivo-assistant-header">
      <div class="aivo-assistant-title-wrap">
        <h3 class="aivo-assistant-title">AIVO AI Yardım</h3>
        <p class="aivo-assistant-subtitle">Hızlı yönlendirme, paket, kredi ve prompt desteği</p>
      </div>
      <button type="button" class="aivo-assistant-close" aria-label="Kapat">×</button>
    </div>

    <div class="aivo-assistant-quick">
      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="Hangi modül ne işe yarar?"
        data-intent="module_selection"
        data-module=""
        data-action=""
        data-action-context="quick_modules_overview"
      >Modülleri Anlat</button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="Bana uygun paketi öner."
        data-intent="pricing_guidance"
        data-module="pricing"
        data-action="package_select"
        data-action-context="quick_pricing_recommendation"
      >Paket Öner</button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="Kredi sistemi nasıl çalışıyor?"
        data-intent="pricing_guidance"
        data-module="pricing"
        data-action="credit_info"
        data-action-context="quick_credit_info"
      >Kredi Sistemi</button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="Promptumu güçlendirmeme yardım et."
        data-intent="prompt_help"
        data-module=""
        data-action="prompt_help"
        data-action-context="quick_prompt_help"
      >Prompt Yardımı</button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="Sorun yaşıyorum, ne yapmalıyım?"
        data-intent="troubleshooting"
        data-module=""
        data-action="troubleshoot"
        data-action-context="quick_troubleshoot"
      >Sorun Çöz</button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="İhtiyacıma göre doğru aracı öner."
        data-intent="module_selection"
        data-module=""
        data-action="recommend_module"
        data-action-context="quick_tool_finder"
      >Doğru Aracı Bul</button>
    </div>

    <div class="aivo-assistant-messages" id="aivo-assistant-messages"></div>

    <form class="aivo-assistant-form" id="aivo-assistant-form">
      <textarea
        class="aivo-assistant-input"
        id="aivo-assistant-input"
        placeholder="Sorunu ya da yapmak istediğini yaz..."
        rows="1"
      ></textarea>
      <button type="submit" class="aivo-assistant-send" id="aivo-assistant-send">Gönder</button>
    </form>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector(".aivo-assistant-close");
  const quickButtons = Array.from(panel.querySelectorAll(".aivo-assistant-chip"));
  const messagesEl = panel.querySelector("#aivo-assistant-messages");
  const formEl = panel.querySelector("#aivo-assistant-form");
  const inputEl = panel.querySelector("#aivo-assistant-input");
  const sendEl = panel.querySelector("#aivo-assistant-send");

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderMessages() {
    messagesEl.innerHTML = state.messages
      .map((msg) => {
        const roleClass =
          msg.role === "user"
            ? "user"
            : msg.role === "assistant"
            ? "assistant"
            : "system";

        return `<div class="aivo-assistant-message ${roleClass}">${escapeHtml(msg.content)}</div>`;
      })
      .join("");

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    inputEl.disabled = isLoading;
    sendEl.disabled = isLoading;
    sendEl.textContent = isLoading ? "Bekle..." : "Gönder";
  }

  function openPanel() {
    state.open = true;
    panel.classList.add("is-open");
    setTimeout(() => inputEl.focus(), 30);
  }

  function closePanel() {
    state.open = false;
    panel.classList.remove("is-open");
  }

  function togglePanel() {
    if (state.open) closePanel();
    else openPanel();
  }

  function autoResize() {
    inputEl.style.height = "46px";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  }

  function getBodyText() {
    return String(document.body?.innerText || "");
  }

  function getPathname() {
    return String(window.location.pathname || "");
  }

  function getPageModuleFromPath(pathname) {
    const path = String(pathname || "").toLowerCase();

    if (path.includes("music")) return "music";
    if (path.includes("cover")) return "cover";
    if (path.includes("atmo") || path.includes("atmosphere")) return "atmo";
    if (path.includes("photofx")) return "photofx";
    if (path.includes("video")) return "video";
    if (path.includes("cartoon") || path.includes("child-cartoon")) return "cartoon";
    if (path.includes("pricing") || path.includes("fiyatlandirma")) return "pricing";

    return "";
  }

  function readWindowRuntimeState() {
    const runtime =
      window.AIVO_ASSISTANT_CONTEXT ||
      window.__AIVO_ASSISTANT_CONTEXT__ ||
      window.AIVO_PAGE_CONTEXT ||
      window.__AIVO_PAGE_CONTEXT__ ||
      null;

    return runtime && typeof runtime === "object" ? runtime : null;
  }

  function buildAssistantContext(extraContext = {}) {
    const pathname = getPathname();
    const bodyText = getBodyText();
    const runtime = readWindowRuntimeState();

    const context = {
      page: pathname,
      module: "",
      intent: extraContext.intent || "",
      action: extraContext.action || "",
      actionContext: extraContext.actionContext || "",
      currentPanel: pathname.replace(/\//g, "") || "unknown",
      currentCardType: "",
      selectedItemType: "",
      lastJobStatus: "",
      userCredits: null,
      creditsNeeded: null,
      hasSelection: null,
      availableActions: [],
      visibleModals: [],
      currentProductCards: [],
      uiState: {
        title: document.title || "",
        pathname,
        bodyText: bodyText.slice(0, 4000),
        quickAction: extraContext
      }
    };

    if (runtime) {
      context.module =
        typeof runtime.module === "string" ? runtime.module : context.module;

      context.actionContext =
        context.actionContext ||
        (typeof runtime.actionContext === "string" ? runtime.actionContext : "");

      context.currentPanel =
        typeof runtime.currentPanel === "string"
          ? runtime.currentPanel
          : context.currentPanel;

      context.currentCardType =
        typeof runtime.currentCardType === "string" ? runtime.currentCardType : "";

      context.selectedItemType =
        typeof runtime.selectedItemType === "string" ? runtime.selectedItemType : "";

      context.lastJobStatus =
        typeof runtime.lastJobStatus === "string" ? runtime.lastJobStatus : "";

      context.userCredits =
        Number.isFinite(Number(runtime.userCredits)) ? Number(runtime.userCredits) : null;

      context.creditsNeeded =
        Number.isFinite(Number(runtime.creditsNeeded)) ? Number(runtime.creditsNeeded) : null;

      context.hasSelection =
        typeof runtime.hasSelection === "boolean" ? runtime.hasSelection : null;

      context.availableActions = Array.isArray(runtime.availableActions)
        ? runtime.availableActions
            .filter((v) => typeof v === "string" && v.trim())
            .map((v) => v.trim())
        : [];

      context.visibleModals = Array.isArray(runtime.visibleModals)
        ? runtime.visibleModals
            .filter((v) => typeof v === "string" && v.trim())
            .map((v) => v.trim())
        : [];

      context.currentProductCards = Array.isArray(runtime.currentProductCards)
        ? runtime.currentProductCards
            .filter((v) => v && typeof v === "object")
            .map((v) => ({
              key: typeof v.key === "string" ? v.key : null,
              label: typeof v.label === "string" ? v.label : null,
              priceTRY: Number.isFinite(Number(v.priceTRY)) ? Number(v.priceTRY) : null,
              credits: Number.isFinite(Number(v.credits)) ? Number(v.credits) : null
            }))
        : [];

      context.uiState = {
        ...context.uiState,
        ...(runtime.uiState && typeof runtime.uiState === "object" ? runtime.uiState : {}),
        quickAction: extraContext
      };
    }

    if (!context.module) {
      context.module = getPageModuleFromPath(pathname);
    }

    if (!context.actionContext) {
      if (/kanal ayırma/i.test(bodyText) && /devam edilsin mi/i.test(bodyText)) {
        context.actionContext = "channel_separation_confirm";
      } else if (/paketi seç/i.test(bodyText)) {
        context.actionContext = "package_selection";
      } else if (/mastering/i.test(bodyText)) {
        context.actionContext = "mastering";
      }
    }

    if (!context.currentCardType) {
      if (/kanal ayırma/i.test(bodyText)) {
        context.currentCardType = "music_card";
      } else if (
        /Yeni Kullanıcı/i.test(bodyText) ||
        /Standart Paket/i.test(bodyText) ||
        /Yaratıcı Üretici/i.test(bodyText) ||
        /Stüdyo \/ Ajans/i.test(bodyText)
      ) {
        context.currentCardType = "pricing_card";
      }
    }

    if (!context.selectedItemType) {
      if (/kanal ayırma/i.test(bodyText)) {
        context.selectedItemType = "music_track";
      } else if (/paketi seç/i.test(bodyText)) {
        context.selectedItemType = "pricing_package";
      }
    }

    if (!context.lastJobStatus) {
      if (/hazır/i.test(bodyText)) {
        context.lastJobStatus = "ready";
      } else if (/processing|hazırlanıyor|işleniyor/i.test(bodyText)) {
        context.lastJobStatus = "processing";
      } else if (/hata|başarısız/i.test(bodyText)) {
        context.lastJobStatus = "failed";
      }
    }

    if (context.userCredits == null) {
      const creditMatch = bodyText.match(/Kredi\s+(\d+)/i);
      context.userCredits = creditMatch ? Number(creditMatch[1]) : null;
    }

    if (context.creditsNeeded == null) {
      if (/Onayla\s*\(\s*5\s*Kredi\s*\)/i.test(bodyText)) {
        context.creditsNeeded = 5;
      } else {
        const neededMatch = bodyText.match(/(\d+)\s*kredi/i);
        context.creditsNeeded = neededMatch ? Number(neededMatch[1]) : null;
      }
    }

    if (context.hasSelection == null) {
      if (/kanal ayırma/i.test(bodyText) || /Onayla\s*\(\s*5\s*Kredi\s*\)/i.test(bodyText)) {
        context.hasSelection = true;
      }
    }

    if (!context.availableActions.length) {
      if (/kanal ayırma/i.test(bodyText)) context.availableActions.push("channel_separation");
      if (/mastering/i.test(bodyText)) context.availableActions.push("mastering");
      if (/paketi seç/i.test(bodyText)) context.availableActions.push("package_select");
      if (/indir/i.test(bodyText)) context.availableActions.push("download");
      if (/dışa aktar|export/i.test(bodyText)) context.availableActions.push("export");
    }

    if (!context.visibleModals.length) {
      if (/kanal ayırma/i.test(bodyText) && /devam edilsin mi/i.test(bodyText)) {
        context.visibleModals.push("channel_separation_confirm");
      }
    }

    if (!context.currentProductCards.length) {
      if (/Yeni Kullanıcı/i.test(bodyText) && /25 kredi/i.test(bodyText) && /199₺/i.test(bodyText)) {
        context.currentProductCards.push({
          key: "starter",
          label: "Yeni Kullanıcı",
          priceTRY: 199,
          credits: 25
        });
      }

      if (/Standart Paket/i.test(bodyText) && /100 kredi/i.test(bodyText) && /699₺/i.test(bodyText)) {
        context.currentProductCards.push({
          key: "standard",
          label: "Standart Paket",
          priceTRY: 699,
          credits: 100
        });
      }

      if (/Yaratıcı Üretici/i.test(bodyText) && /200 kredi/i.test(bodyText) && /1\.299₺/i.test(bodyText)) {
        context.currentProductCards.push({
          key: "pro",
          label: "Yaratıcı Üretici",
          priceTRY: 1299,
          credits: 200
        });
      }

      if (/Stüdyo \/ Ajans/i.test(bodyText) && /500 kredi/i.test(bodyText) && /2\.999₺/i.test(bodyText)) {
        context.currentProductCards.push({
          key: "studio",
          label: "Stüdyo / Ajans",
          priceTRY: 2999,
          credits: 500
        });
      }
    }

    return context;
  }

  async function sendMessage(text, extraContext = {}) {
    const content = String(text || "").trim();
    if (!content || state.loading) return;

    state.messages.push({
      role: "user",
      content
    });
    renderMessages();
    inputEl.value = "";
    autoResize();

    setLoading(true);

    try {
          const assistantContext = buildAssistantContext(extraContext);

      const atmoDiagnostic =
        window.__AIVO_ATMO_ASSISTANT_STATE__ &&
        typeof window.__AIVO_ATMO_ASSISTANT_STATE__ === "object"
          ? { ...window.__AIVO_ATMO_ASSISTANT_STATE__ }
          : null;

      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
          const cartoonDiagnostic =
  window.__AIVO_CARTOON_ASSISTANT_STATE__ &&
  typeof window.__AIVO_CARTOON_ASSISTANT_STATE__ === "object"
    ? { ...window.__AIVO_CARTOON_ASSISTANT_STATE__ }
    : null;

const photoFxDiagnostic =
  window.__AIVO_PHOTOFX_ASSISTANT_STATE__ &&
  typeof window.__AIVO_PHOTOFX_ASSISTANT_STATE__ === "object"
    ? { ...window.__AIVO_PHOTOFX_ASSISTANT_STATE__ }
    : null;

const videoDiagnostic =
  window.__AIVO_VIDEO_ASSISTANT_STATE__ &&
  typeof window.__AIVO_VIDEO_ASSISTANT_STATE__ === "object"
    ? { ...window.__AIVO_VIDEO_ASSISTANT_STATE__ }
    : null;

body: JSON.stringify({
  ...assistantContext,
  message: content,
  atmoDiagnostic,
  cartoonDiagnostic,
  photoFxDiagnostic,
  videoDiagnostic,
  messages: state.messages
})
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "İstek başarısız oldu.");
      }

      const brain = data?.brain && typeof data.brain === "object" ? data.brain : null;

      let assistantText =
        (brain?.answer && String(brain.answer).trim()) ||
        (data?.message && String(data.message).trim()) ||
        "Şu anda cevap üretilemedi.";

      if (brain?.followupAction) {
        assistantText += `

Sonraki adım: ${brain.followupAction}`;
      }

      if (brain?.needsConfirmation) {
        assistantText += `

Bu işlem onay gerektiriyor.`;
      }

      if (brain?.confidence === "low") {
        let hintText =
          "Daha net yönlendirme için bulunduğun ekranı veya yapmak istediğin işlemi biraz daha açık yaz.";

        if (brain?.intent === "pricing_guidance") {
          hintText =
            "Daha net paket önerisi için ne üretmek istediğini ve kullanım sıklığını kısa yaz.";
        } else if (brain?.intent === "troubleshooting") {
          hintText =
            "Daha net çözüm için hangi modülde olduğunu ve ekranda gördüğün durumu kısa yaz.";
        } else if (brain?.intent === "prompt_help") {
          hintText =
            "Daha güçlü prompt desteği için ne üretmek istediğini kısa ve net yaz.";
        } else if (brain?.intent === "module_selection") {
          hintText =
            "Doğru modülü önermem için üretmek istediğin içeriği kısa yaz.";
        } else if (brain?.intent === "product_action") {
          hintText =
            "Doğru aksiyonu söylemem için bulunduğun ekranı, kartı veya menüyü biraz daha net yaz.";
        }

        assistantText += `

${hintText}`;
      }

      state.messages.push({
        role: "assistant",
        content: assistantText
      });
    } catch (error) {
      state.messages.push({
        role: "assistant",
        content:
          "Şu anda yardımcı asistana bağlanırken bir sorun oluştu. Lütfen biraz sonra tekrar dene."
      });
      console.error("[AIVO Assistant Widget Error]", error);
    } finally {
      setLoading(false);
      renderMessages();
      inputEl.focus();
    }
  }

  launcher.addEventListener("click", togglePanel);
  closeBtn.addEventListener("click", closePanel);

  quickButtons.forEach((button) => {
    button.addEventListener("click", function () {
      openPanel();

      sendMessage(button.getAttribute("data-prompt") || "", {
        intent: button.getAttribute("data-intent") || "",
        module: button.getAttribute("data-module") || "",
        action: button.getAttribute("data-action") || "",
        actionContext: button.getAttribute("data-action-context") || "",
        source: "quick_action_button"
      });
    });
  });

  formEl.addEventListener("submit", function (event) {
    event.preventDefault();
    sendMessage(inputEl.value);
  });

  inputEl.addEventListener("input", autoResize);

  inputEl.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(inputEl.value);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.open) {
      closePanel();
    }
  });

  renderMessages();
})();
