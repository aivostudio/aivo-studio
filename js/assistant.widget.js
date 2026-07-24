(function () {
  "use strict";

  if (window.__AIVO_ASSISTANT_WIDGET__) return;

  function readLocalStorage(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (_) {
      return "";
    }
  }

  const hasSession =
    readLocalStorage("aivo_auth_unified_v1") ||
    readLocalStorage("aivo_token") ||
    document.cookie.includes("aivo_session") ||
    document.cookie.includes("aivo_sess");

  if (!hasSession) return;

  window.__AIVO_ASSISTANT_WIDGET__ = true;

  const LANGUAGE_KEYS = [
    "aivo_language",
    "aivo_mobile_language"
  ];

  function normalizeLanguage(value) {
    const raw = String(value || "")
      .trim()
      .toLowerCase();

    return raw.startsWith("tr")
      ? "tr"
      : "en";
  }

  function getStoredLanguage() {
    for (const key of LANGUAGE_KEYS) {
      const value = readLocalStorage(key);

      if (value) {
        return normalizeLanguage(value);
      }
    }

    return "";
  }

  function getCurrentLanguage() {
    const runtimeLanguage =
      window.AIVO_LANG ||
      window.__AIVO_LANG__ ||
      "";

    if (runtimeLanguage) {
      return normalizeLanguage(
        runtimeLanguage
      );
    }

    const storedLanguage =
      getStoredLanguage();

    if (storedLanguage) {
      return storedLanguage;
    }

    const documentLanguage =
      document.documentElement
        .getAttribute("lang") ||
      "";

    if (documentLanguage) {
      return normalizeLanguage(
        documentLanguage
      );
    }

    return normalizeLanguage(
      navigator.language ||
      navigator.userLanguage ||
      "en"
    );
  }

  const COPY = {
    tr: {
      launcher:
        "AI Yardım",

      title:
        "AIVO AI Yardım",

      subtitle:
        "Hızlı yönlendirme, paket, kredi ve prompt desteği",

      closeLabel:
        "Kapat",

      welcome:
        "Merhaba, ben AIVO yardımcı asistanıyım. İstersen modüller, paket seçimi, kredi sistemi, prompt yazımı ya da yaşadığın bir sorunda sana adım adım yardımcı olayım. Ne yapmak istiyorsun?",

      quickModulesLabel:
        "Modülleri Anlat",

      quickModulesPrompt:
        "Hangi modül ne işe yarar?",

      quickPricingLabel:
        "Paket Öner",

      quickPricingPrompt:
        "Bana uygun paketi öner.",

      quickCreditsLabel:
        "Kredi Sistemi",

      quickCreditsPrompt:
        "Kredi sistemi nasıl çalışıyor?",

      quickPromptLabel:
        "Prompt Güçlendir",

      quickPromptPrompt:
        "Fikrimi güçlü, üretime hazır bir prompta çevir. Gerekirse eksikleri tamamla, modüle uygun yaz ve bana direkt kullanabileceğim en güçlü promptu ver.",

      quickTroubleshootLabel:
        "Sorun Çöz",

      quickTroubleshootPrompt:
        "Sorun yaşıyorum, ne yapmalıyım?",

      quickToolLabel:
        "Doğru Aracı Bul",

      quickToolPrompt:
        "İhtiyacıma göre doğru aracı öner.",

      inputPlaceholder:
        "Sorunu ya da yapmak istediğini yaz...",

      send:
        "Gönder",

      waiting:
        "Bekle...",

      requestFailed:
        "İstek başarısız oldu.",

      fallbackAnswer:
        "Şu an net bir cevap oluşturamadım ama istersen fikrini birlikte güçlü ve üretime hazır bir prompta çevirebiliriz.",

      followupPrefix:
        "Buradan devam etmek için en net adım:",

      confirmation:
        "Devam etmeden önce bu işlem için onay gerekiyor.",

      lowConfidenceGeneral:
        "Sana daha net yardımcı olabilmem için bulunduğun ekranı ya da yapmak istediğin şeyi biraz daha açık yazabilir misin?",

      lowConfidencePricing:
        "Sana daha doğru paket önerebilmem için ne üretmek istediğini ve ne sıklıkla kullanacağını kısa yazabilir misin?",

      lowConfidenceTroubleshooting:
        "Bunu birlikte netleştirelim: hangi modüldesin ve ekranda tam olarak ne görüyorsun, kısa yazman yeterli.",

      lowConfidencePrompt:
        "Ne üretmek istediğini tek cümleyle yaz. Ben onu senin için güçlü, detaylı, modüle uygun ve direkt kullanılabilir bir prompta çevireyim. İstersen stil, atmosfer, karakter, renk, kamera açısı, kalite ve duygu tonunu da birlikte kurarım.",

      lowConfidenceModule:
        "Sana doğru modülü önermem için üretmek istediğin içeriği kısaca yazabilir misin?",

      lowConfidenceAction:
        "Sana doğru adımı söyleyebilmem için bulunduğun ekranı, kartı ya da menüyü biraz daha net tarif etmen yeterli.",

      connectionError:
        "Şu anda yardımcı asistana bağlanırken küçük bir sorun oluştu. Birkaç saniye sonra tekrar dener misin?"
    },

    en: {
      launcher:
        "AI Help",

      title:
        "AIVO AI Assistant",

      subtitle:
        "Quick guidance for tools, plans, credits and prompts",

      closeLabel:
        "Close",

      welcome:
        "Hi, I’m the AIVO assistant. I can guide you through the tools, plan selection, the credit system, prompt writing or any issue you are experiencing. What would you like to do?",

      quickModulesLabel:
        "Explain the Tools",

      quickModulesPrompt:
        "What does each AIVO tool do?",

      quickPricingLabel:
        "Recommend a Plan",

      quickPricingPrompt:
        "Recommend the right plan for me.",

      quickCreditsLabel:
        "Credit System",

      quickCreditsPrompt:
        "How does the credit system work?",

      quickPromptLabel:
        "Improve My Prompt",

      quickPromptPrompt:
        "Turn my idea into a strong, production-ready prompt. Fill in any missing details, adapt it to the right tool and give me the strongest prompt I can use directly.",

      quickTroubleshootLabel:
        "Solve a Problem",

      quickTroubleshootPrompt:
        "I’m having a problem. What should I do?",

      quickToolLabel:
        "Find the Right Tool",

      quickToolPrompt:
        "Recommend the right tool for my needs.",

      inputPlaceholder:
        "Describe your issue or what you want to create...",

      send:
        "Send",

      waiting:
        "Please wait...",

      requestFailed:
        "The request failed.",

      fallbackAnswer:
        "I could not create a clear answer right now, but we can turn your idea into a strong, production-ready prompt together.",

      followupPrefix:
        "The clearest next step is:",

      confirmation:
        "This action requires your confirmation before we continue.",

      lowConfidenceGeneral:
        "Could you describe the screen you are on or what you want to do in a little more detail so I can guide you accurately?",

      lowConfidencePricing:
        "What would you like to create, and how often do you expect to use AIVO? A short answer is enough for me to recommend the right plan.",

      lowConfidenceTroubleshooting:
        "Let’s narrow this down together. Which tool are you using, and what exactly do you see on the screen?",

      lowConfidencePrompt:
        "Describe what you want to create in one sentence. I’ll turn it into a strong, detailed, tool-specific prompt you can use directly, including style, atmosphere, character, color, camera, quality and emotional tone when helpful.",

      lowConfidenceModule:
        "Briefly describe the content you want to create so I can recommend the right AIVO tool.",

      lowConfidenceAction:
        "Describe the screen, card or menu you are currently using so I can give you the exact next step.",

      connectionError:
        "A small connection problem occurred while reaching the assistant. Please try again in a few seconds."
    }
  };

  const STYLE_ID =
    "aivo-assistant-widget-style";

  if (!document.getElementById(STYLE_ID)) {
    const style =
      document.createElement("style");

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
          radial-gradient(
            circle at top left,
            rgba(124,77,255,.16),
            transparent 34%
          ),
          radial-gradient(
            circle at top right,
            rgba(255,79,163,.14),
            transparent 28%
          ),
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
        padding: 8px 12px 0;
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      .aivo-assistant-chip {
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.05);
        color: #fff;
        border-radius: 999px;
        padding: 7px 10px;
        cursor: pointer;
        font: 600 10px/1.05 Inter, Arial, sans-serif;
        transition:
          background .16s ease,
          border-color .16s ease,
          transform .16s ease;
      }

      .aivo-assistant-chip:hover {
        background: rgba(255,255,255,.08);
        border-color: rgba(255,255,255,.14);
        transform: translateY(-1px);
      }

      .aivo-assistant-messages {
        flex: 1;
        overflow: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .aivo-assistant-message {
        max-width: 86%;
        padding: 9px 10px;
        border-radius: 14px;
        white-space: pre-wrap;
        word-break: break-word;
        font: 400 12px/1.42 Inter, Arial, sans-serif;
      }

      .aivo-assistant-message.user {
        align-self: flex-end;
        background: linear-gradient(
          135deg,
          #7c4dff 0%,
          #ff4fa3 100%
        );
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
        font-size: 10px;
        padding: 2px 7px;
      }

      .aivo-assistant-form {
        padding: 10px;
        border-top: 1px solid rgba(255,255,255,.08);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .aivo-assistant-input {
        flex: 1;
        min-width: 0;
        display: block;
        resize: none;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.05);
        color: #fff;
        border-radius: 15px;
        padding: 11px 13px;
        outline: none;
        height: 42px;
        min-height: 42px;
        max-height: 96px;
        box-sizing: border-box;
        overflow-y: auto;
        font: 400 12px/1.25 Inter, Arial, sans-serif;
      }

      .aivo-assistant-input::placeholder {
        color: rgba(255,255,255,.36);
      }

      .aivo-assistant-send {
        border: 0;
        min-width: 82px;
        height: 42px;
        border-radius: 15px;
        background: linear-gradient(
          135deg,
          #7c4dff 0%,
          #ff4fa3 100%
        );
        color: #fff;
        padding: 0 14px;
        font: 800 12px/1 Inter, Arial, sans-serif;
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
    lang: getCurrentLanguage(),
    messages: [
      {
        role: "assistant",
        i18nKey: "welcome",
        content: ""
      }
    ]
  };

  function text(key) {
    return (
      COPY[state.lang]?.[key] ||
      COPY.tr[key] ||
      key
    );
  }

  const launcher =
    document.createElement("button");

  launcher.type = "button";

  launcher.className =
    "aivo-assistant-launcher";

  const panel =
    document.createElement("section");

  panel.className =
    "aivo-assistant-panel";

  panel.innerHTML = `
    <div class="aivo-assistant-header">
      <div class="aivo-assistant-title-wrap">
        <h3
          class="aivo-assistant-title"
          data-assistant-text="title"
        ></h3>

        <p
          class="aivo-assistant-subtitle"
          data-assistant-text="subtitle"
        ></p>
      </div>

      <button
        type="button"
        class="aivo-assistant-close"
      >×</button>
    </div>

    <div class="aivo-assistant-quick">
      <button
        type="button"
        class="aivo-assistant-chip"
        data-label-key="quickModulesLabel"
        data-prompt-key="quickModulesPrompt"
        data-intent="module_selection"
        data-module=""
        data-action=""
        data-action-context="quick_modules_overview"
      ></button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-label-key="quickPricingLabel"
        data-prompt-key="quickPricingPrompt"
        data-intent="pricing_guidance"
        data-module="pricing"
        data-action="package_select"
        data-action-context="quick_pricing_recommendation"
      ></button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-label-key="quickCreditsLabel"
        data-prompt-key="quickCreditsPrompt"
        data-intent="pricing_guidance"
        data-module="pricing"
        data-action="credit_info"
        data-action-context="quick_credit_info"
      ></button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-label-key="quickPromptLabel"
        data-prompt-key="quickPromptPrompt"
        data-intent="prompt_help"
        data-module=""
        data-action="prompt_help"
        data-action-context="quick_prompt_help_max"
      ></button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-label-key="quickTroubleshootLabel"
        data-prompt-key="quickTroubleshootPrompt"
        data-intent="troubleshooting"
        data-module=""
        data-action="troubleshoot"
        data-action-context="quick_troubleshoot"
      ></button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-label-key="quickToolLabel"
        data-prompt-key="quickToolPrompt"
        data-intent="module_selection"
        data-module=""
        data-action="recommend_module"
        data-action-context="quick_tool_finder"
      ></button>
    </div>

    <div
      class="aivo-assistant-messages"
      id="aivo-assistant-messages"
    ></div>

    <form
      class="aivo-assistant-form"
      id="aivo-assistant-form"
    >
      <textarea
        class="aivo-assistant-input"
        id="aivo-assistant-input"
        rows="1"
        spellcheck="false"
      ></textarea>

      <button
        type="submit"
        class="aivo-assistant-send"
        id="aivo-assistant-send"
      ></button>
    </form>
  `;

  document.body.appendChild(
    launcher
  );

  document.body.appendChild(
    panel
  );

  const titleEl =
    panel.querySelector(
      "[data-assistant-text='title']"
    );

  const subtitleEl =
    panel.querySelector(
      "[data-assistant-text='subtitle']"
    );

  const closeBtn =
    panel.querySelector(
      ".aivo-assistant-close"
    );

  const quickButtons =
    Array.from(
      panel.querySelectorAll(
        ".aivo-assistant-chip"
      )
    );

  const messagesEl =
    panel.querySelector(
      "#aivo-assistant-messages"
    );

  const formEl =
    panel.querySelector(
      "#aivo-assistant-form"
    );

  const inputEl =
    panel.querySelector(
      "#aivo-assistant-input"
    );

  const sendEl =
    panel.querySelector(
      "#aivo-assistant-send"
    );

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderMessages() {
    messagesEl.innerHTML =
      state.messages
        .map(function (message) {
          const roleClass =
            message.role === "user"
              ? "user"
              : message.role === "assistant"
                ? "assistant"
                : "system";

          return (
            `<div class="aivo-assistant-message ${roleClass}">` +
            `${escapeHtml(message.content)}` +
            "</div>"
          );
        })
        .join("");

    messagesEl.scrollTop =
      messagesEl.scrollHeight;
  }

  function setLoading(isLoading) {
    state.loading =
      Boolean(isLoading);

    inputEl.disabled =
      state.loading;

    sendEl.disabled =
      state.loading;

    sendEl.textContent =
      state.loading
        ? text("waiting")
        : text("send");
  }

  function syncTranslatedMessages() {
    state.messages.forEach(
      function (message) {
        if (!message.i18nKey) {
          return;
        }

        message.content =
          text(message.i18nKey);
      }
    );
  }

  function applyLanguage() {
    state.lang =
      getCurrentLanguage();

    launcher.textContent =
      text("launcher");

    launcher.setAttribute(
      "aria-label",
      text("launcher")
    );

    titleEl.textContent =
      text("title");

    subtitleEl.textContent =
      text("subtitle");

    closeBtn.setAttribute(
      "aria-label",
      text("closeLabel")
    );

    inputEl.placeholder =
      text("inputPlaceholder");

    quickButtons.forEach(
      function (button) {
        const labelKey =
          button.getAttribute(
            "data-label-key"
          ) || "";

        const promptKey =
          button.getAttribute(
            "data-prompt-key"
          ) || "";

        button.textContent =
          text(labelKey);

        button.setAttribute(
          "data-prompt",
          text(promptKey)
        );
      }
    );

    syncTranslatedMessages();
    setLoading(state.loading);
    renderMessages();

    if (state.open) {
      requestAnimationFrame(
        autoResize
      );
    }
  }

  function openPanel() {
    state.open = true;

    panel.classList.add(
      "is-open"
    );

    requestAnimationFrame(
      function () {
        autoResize();
        inputEl.focus();
      }
    );
  }

  function closePanel() {
    state.open = false;

    panel.classList.remove(
      "is-open"
    );
  }

  function togglePanel() {
    if (state.open) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function autoResize() {
    inputEl.style.height =
      "44px";

    inputEl.style.height =
      Math.min(
        inputEl.scrollHeight,
        104
      ) + "px";
  }

  function getBodyText() {
    return String(
      document.body?.innerText ||
      ""
    );
  }

  function getPathname() {
    return String(
      window.location.pathname ||
      ""
    );
  }

  function getPageModuleFromPath(
    pathname
  ) {
    const path =
      String(pathname || "")
        .toLowerCase();

    if (path.includes("music")) {
      return "music";
    }

    if (path.includes("cover")) {
      return "cover";
    }

    if (
      path.includes("atmo") ||
      path.includes("atmosphere")
    ) {
      return "atmo";
    }

    if (path.includes("photofx")) {
      return "photofx";
    }

    if (path.includes("video")) {
      return "video";
    }

    if (
      path.includes("cartoon") ||
      path.includes("child-cartoon")
    ) {
      return "cartoon";
    }

    if (
      path.includes("pricing") ||
      path.includes("fiyatlandirma")
    ) {
      return "pricing";
    }

    return "";
  }

  function readWindowRuntimeState() {
    const runtime =
      window.AIVO_ASSISTANT_CONTEXT ||
      window.__AIVO_ASSISTANT_CONTEXT__ ||
      window.AIVO_PAGE_CONTEXT ||
      window.__AIVO_PAGE_CONTEXT__ ||
      null;

    return (
      runtime &&
      typeof runtime === "object"
    )
      ? runtime
      : null;
  }

  function detectActiveAssistantModuleFromDOM() {
    const cartoonRoot =
      document.querySelector(
        '.main-panel[data-module="cartoon"]'
      ) ||
      document.querySelector(
        '[data-module="cartoon"]'
      );

    if (cartoonRoot) {
      const activeCartoonView =
        cartoonRoot.querySelector(
          '.cartoon-mode-view.is-active[data-cartoon-view]'
        ) ||
        Array.from(
          cartoonRoot.querySelectorAll(
            "[data-cartoon-view]"
          )
        ).find(
          function (element) {
            return !element.hidden;
          }
        ) ||
        null;

      const cartoonView =
        String(
          activeCartoonView
            ?.getAttribute(
              "data-cartoon-view"
            ) ||
          ""
        ).trim();

      return {
        module:
          "cartoon",

        actionContext:
          cartoonView === "character"
            ? "cartoon_character"
            : cartoonView === "basic"
              ? "cartoon_basic"
              : cartoonView === "story"
                ? "cartoon_story"
                : cartoonView === "studio"
                  ? "cartoon_studio"
                  : "cartoon"
      };
    }

    const photoFxRoot =
      document.querySelector(
        '.main-panel[data-module="photofx"]'
      ) ||
      document.querySelector(
        '[data-module="photofx"]'
      );

    if (photoFxRoot) {
      return {
        module:
          "photofx",

        actionContext:
          "photofx"
      };
    }

    const videoRoot =
      document.querySelector(
        'section[data-module="video"]'
      ) ||
      document.querySelector(
        '.main-panel[data-module="video"]'
      ) ||
      document.querySelector(
        '[data-module="video"]'
      );

    if (videoRoot) {
      return {
        module:
          "video",

        actionContext:
          "video"
      };
    }

    const atmoRoot =
      document.querySelector(
        '.main-panel[data-module="atmo"]'
      ) ||
      document.querySelector(
        '[data-module="atmo"]'
      );

    if (atmoRoot) {
      return {
        module:
          "atmo",

        actionContext:
          "atmo"
      };
    }

    const coverRoot =
      document.querySelector(
        '.main-panel[data-module="cover"]'
      ) ||
      document.querySelector(
        '[data-module="cover"]'
      );

    if (coverRoot) {
      return {
        module:
          "cover",

        actionContext:
          "cover"
      };
    }

    const musicRoot =
      document.querySelector(
        '.main-panel[data-module="music"]'
      ) ||
      document.querySelector(
        '[data-module="music"]'
      );

    if (musicRoot) {
      return {
        module:
          "music",

        actionContext:
          "music"
      };
    }

    return {
      module:
        "",

      actionContext:
        ""
    };
  }

  function buildAssistantContext(
    extraContext = {}
  ) {
    const pathname =
      getPathname();

    const bodyText =
      getBodyText();

    const runtime =
      readWindowRuntimeState();

    const domDetected =
      detectActiveAssistantModuleFromDOM();

    const context = {
      lang:
        state.lang,

      language:
        state.lang,

      page:
        pathname,

      module:
        domDetected.module ||
        "",

      intent:
        extraContext.intent ||
        "",

      action:
        extraContext.action ||
        "",

      actionContext:
        extraContext.actionContext ||
        domDetected.actionContext ||
        "",

      currentPanel:
        pathname.replace(
          /\//g,
          ""
        ) ||
        "unknown",

      currentCardType:
        "",

      selectedItemType:
        "",

      lastJobStatus:
        "",

      userCredits:
        null,

      creditsNeeded:
        null,

      hasSelection:
        null,

      availableActions:
        [],

      visibleModals:
        [],

      currentProductCards:
        [],

      uiState: {
        title:
          document.title ||
          "",

        pathname,

        language:
          state.lang,

        bodyText:
          bodyText.slice(
            0,
            4000
          ),

        quickAction:
          extraContext
      }
    };

    if (runtime) {
      context.module =
        context.module ||
        (
          typeof runtime.module ===
          "string"
            ? runtime.module
            : context.module
        );

      context.actionContext =
        context.actionContext ||
        (
          typeof runtime.actionContext ===
          "string"
            ? runtime.actionContext
            : ""
        ) ||
        domDetected.actionContext ||
        "";

      context.currentPanel =
        typeof runtime.currentPanel ===
        "string"
          ? runtime.currentPanel
          : context.currentPanel;

      context.currentCardType =
        typeof runtime.currentCardType ===
        "string"
          ? runtime.currentCardType
          : "";

      context.selectedItemType =
        typeof runtime.selectedItemType ===
        "string"
          ? runtime.selectedItemType
          : "";

      context.lastJobStatus =
        typeof runtime.lastJobStatus ===
        "string"
          ? runtime.lastJobStatus
          : "";

      context.userCredits =
        Number.isFinite(
          Number(
            runtime.userCredits
          )
        )
          ? Number(
              runtime.userCredits
            )
          : null;

      context.creditsNeeded =
        Number.isFinite(
          Number(
            runtime.creditsNeeded
          )
        )
          ? Number(
              runtime.creditsNeeded
            )
          : null;

      context.hasSelection =
        typeof runtime.hasSelection ===
        "boolean"
          ? runtime.hasSelection
          : null;

      context.availableActions =
        Array.isArray(
          runtime.availableActions
        )
          ? runtime.availableActions
              .filter(
                function (value) {
                  return (
                    typeof value ===
                    "string" &&
                    value.trim()
                  );
                }
              )
              .map(
                function (value) {
                  return value.trim();
                }
              )
          : [];

      context.visibleModals =
        Array.isArray(
          runtime.visibleModals
        )
          ? runtime.visibleModals
              .filter(
                function (value) {
                  return (
                    typeof value ===
                    "string" &&
                    value.trim()
                  );
                }
              )
              .map(
                function (value) {
                  return value.trim();
                }
              )
          : [];

      context.currentProductCards =
        Array.isArray(
          runtime.currentProductCards
        )
          ? runtime.currentProductCards
              .filter(
                function (value) {
                  return (
                    value &&
                    typeof value ===
                    "object"
                  );
                }
              )
              .map(
                function (value) {
                  return {
                    key:
                      typeof value.key ===
                      "string"
                        ? value.key
                        : null,

                    label:
                      typeof value.label ===
                      "string"
                        ? value.label
                        : null,

                    priceTRY:
                      Number.isFinite(
                        Number(
                          value.priceTRY
                        )
                      )
                        ? Number(
                            value.priceTRY
                          )
                        : null,

                    credits:
                      Number.isFinite(
                        Number(
                          value.credits
                        )
                      )
                        ? Number(
                            value.credits
                          )
                        : null
                  };
                }
              )
          : [];

      context.uiState = {
        ...context.uiState,

        ...(
          runtime.uiState &&
          typeof runtime.uiState ===
          "object"
            ? runtime.uiState
            : {}
        ),

        language:
          state.lang,

        quickAction:
          extraContext
      };
    }

    if (!context.module) {
      context.module =
        getPageModuleFromPath(
          pathname
        );
    }

    const channelSeparationDetected =
      /kanal ayırma|channel separation|separate channels|separate stems/i
        .test(bodyText);

    const continueConfirmationDetected =
      /devam edilsin mi|continue\?|would you like to continue|proceed/i
        .test(bodyText);

    const packageSelectionDetected =
      /paketi seç|paket seç|select package|choose a plan|select a plan/i
        .test(bodyText);

    const masteringDetected =
      /mastering/i
        .test(bodyText);

    if (!context.actionContext) {
      if (
        channelSeparationDetected &&
        continueConfirmationDetected
      ) {
        context.actionContext =
          "channel_separation_confirm";
      } else if (
        packageSelectionDetected
      ) {
        context.actionContext =
          "package_selection";
      } else if (
        masteringDetected
      ) {
        context.actionContext =
          "mastering";
      }
    }

    const pricingCardDetected =
      /Yeni Kullanıcı|Standart Paket|Yaratıcı Üretici|Stüdyo \/ Ajans|New User|Starter|Standard Package|Creative Producer|Studio \/ Agency/i
        .test(bodyText);

    if (!context.currentCardType) {
      if (channelSeparationDetected) {
        context.currentCardType =
          "music_card";
      } else if (
        pricingCardDetected
      ) {
        context.currentCardType =
          "pricing_card";
      }
    }

    if (!context.selectedItemType) {
      if (channelSeparationDetected) {
        context.selectedItemType =
          "music_track";
      } else if (
        packageSelectionDetected
      ) {
        context.selectedItemType =
          "pricing_package";
      }
    }

    if (!context.lastJobStatus) {
      if (
        /hazır|ready/i
          .test(bodyText)
      ) {
        context.lastJobStatus =
          "ready";
      } else if (
        /processing|hazırlanıyor|işleniyor|preparing/i
          .test(bodyText)
      ) {
        context.lastJobStatus =
          "processing";
      } else if (
        /hata|başarısız|error|failed/i
          .test(bodyText)
      ) {
        context.lastJobStatus =
          "failed";
      }
    }

    if (
      context.userCredits ==
      null
    ) {
      const creditMatch =
        bodyText.match(
          /(?:Kredi|Credit|Credits)\s*[:：]?\s*(\d+)/i
        );

      context.userCredits =
        creditMatch
          ? Number(
              creditMatch[1]
            )
          : null;
    }

    if (
      context.creditsNeeded ==
      null
    ) {
      if (
        /(?:Onayla|Confirm)\s*\(\s*5\s*(?:Kredi|Credits?)\s*\)/i
          .test(bodyText)
      ) {
        context.creditsNeeded =
          5;
      } else {
        const neededMatch =
          bodyText.match(
            /(\d+)\s*(?:kredi|credits?)/i
          );

        context.creditsNeeded =
          neededMatch
            ? Number(
                neededMatch[1]
              )
            : null;
      }
    }

    if (
      context.hasSelection ==
      null
    ) {
      if (
        channelSeparationDetected ||
        /(?:Onayla|Confirm)\s*\(\s*5\s*(?:Kredi|Credits?)\s*\)/i
          .test(bodyText)
      ) {
        context.hasSelection =
          true;
      }
    }

    if (
      !context.availableActions
        .length
    ) {
      if (
        channelSeparationDetected
      ) {
        context.availableActions
          .push(
            "channel_separation"
          );
      }

      if (masteringDetected) {
        context.availableActions
          .push(
            "mastering"
          );
      }

      if (
        packageSelectionDetected
      ) {
        context.availableActions
          .push(
            "package_select"
          );
      }

      if (
        /indir|download/i
          .test(bodyText)
      ) {
        context.availableActions
          .push(
            "download"
          );
      }

      if (
        /dışa aktar|export/i
          .test(bodyText)
      ) {
        context.availableActions
          .push(
            "export"
          );
      }
    }

    if (
      !context.visibleModals
        .length
    ) {
      if (
        channelSeparationDetected &&
        continueConfirmationDetected
      ) {
        context.visibleModals
          .push(
            "channel_separation_confirm"
          );
      }
    }

    if (
      !context.currentProductCards
        .length
    ) {
      if (
        /Yeni Kullanıcı|New User|Starter/i
          .test(bodyText) &&
        /25\s*(?:kredi|credits?)/i
          .test(bodyText) &&
        /199\s*₺/i
          .test(bodyText)
      ) {
        context.currentProductCards
          .push({
            key:
              "starter",

            label:
              state.lang === "en"
                ? "New User"
                : "Yeni Kullanıcı",

            priceTRY:
              199,

            credits:
              25
          });
      }

      if (
        /Standart Paket|Standard Package/i
          .test(bodyText) &&
        /100\s*(?:kredi|credits?)/i
          .test(bodyText) &&
        /699\s*₺/i
          .test(bodyText)
      ) {
        context.currentProductCards
          .push({
            key:
              "standard",

            label:
              state.lang === "en"
                ? "Standard Package"
                : "Standart Paket",

            priceTRY:
              699,

            credits:
              100
          });
      }

      if (
        /Yaratıcı Üretici|Creative Producer/i
          .test(bodyText) &&
        /200\s*(?:kredi|credits?)/i
          .test(bodyText) &&
        /1[\.,]299\s*₺/i
          .test(bodyText)
      ) {
        context.currentProductCards
          .push({
            key:
              "pro",

            label:
              state.lang === "en"
                ? "Creative Producer"
                : "Yaratıcı Üretici",

            priceTRY:
              1299,

            credits:
              200
          });
      }

      if (
        /Stüdyo \/ Ajans|Studio \/ Agency/i
          .test(bodyText) &&
        /500\s*(?:kredi|credits?)/i
          .test(bodyText) &&
        /2[\.,]999\s*₺/i
          .test(bodyText)
      ) {
        context.currentProductCards
          .push({
            key:
              "studio",

            label:
              state.lang === "en"
                ? "Studio / Agency"
                : "Stüdyo / Ajans",

            priceTRY:
              2999,

            credits:
              500
          });
      }
    }

    return context;
  }

  function getLowConfidenceHint(
    intent
  ) {
    if (
      intent ===
      "pricing_guidance"
    ) {
      return text(
        "lowConfidencePricing"
      );
    }

    if (
      intent ===
      "troubleshooting"
    ) {
      return text(
        "lowConfidenceTroubleshooting"
      );
    }

    if (
      intent ===
      "prompt_help"
    ) {
      return text(
        "lowConfidencePrompt"
      );
    }

    if (
      intent ===
      "module_selection"
    ) {
      return text(
        "lowConfidenceModule"
      );
    }

    if (
      intent ===
      "product_action"
    ) {
      return text(
        "lowConfidenceAction"
      );
    }

    return text(
      "lowConfidenceGeneral"
    );
  }

  async function sendMessage(
    value,
    extraContext = {}
  ) {
    const content =
      String(value || "")
        .trim();

    if (
      !content ||
      state.loading
    ) {
      return;
    }

    state.messages.push({
      role:
        "user",

      content
    });

    renderMessages();

    inputEl.value =
      "";

    autoResize();
    setLoading(true);

    try {
      const assistantContext =
        buildAssistantContext(
          extraContext
        );

      const atmoDiagnostic =
        window
          .__AIVO_ATMO_ASSISTANT_STATE__ &&
        typeof window
          .__AIVO_ATMO_ASSISTANT_STATE__ ===
          "object"
          ? {
              ...window
                .__AIVO_ATMO_ASSISTANT_STATE__
            }
          : null;

      const cartoonDiagnostic =
        window
          .__AIVO_CARTOON_ASSISTANT_STATE__ &&
        typeof window
          .__AIVO_CARTOON_ASSISTANT_STATE__ ===
          "object"
          ? {
              ...window
                .__AIVO_CARTOON_ASSISTANT_STATE__
            }
          : null;

      const photoFxDiagnostic =
        window
          .__AIVO_PHOTOFX_ASSISTANT_STATE__ &&
        typeof window
          .__AIVO_PHOTOFX_ASSISTANT_STATE__ ===
          "object"
          ? {
              ...window
                .__AIVO_PHOTOFX_ASSISTANT_STATE__
            }
          : null;

      const videoDiagnostic =
        window
          .__AIVO_VIDEO_ASSISTANT_STATE__ &&
        typeof window
          .__AIVO_VIDEO_ASSISTANT_STATE__ ===
          "object"
          ? {
              ...window
                .__AIVO_VIDEO_ASSISTANT_STATE__
            }
          : null;

      const response =
        await fetch(
          "/api/assistant/chat",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              "X-AIVO-Language":
                state.lang
            },

            body:
              JSON.stringify({
                ...assistantContext,

                lang:
                  state.lang,

                language:
                  state.lang,

                message:
                  content,

                atmoDiagnostic,

                cartoonDiagnostic,

                photoFxDiagnostic,

                videoDiagnostic,

                messages:
                  state.messages
                    .map(
                      function (
                        message
                      ) {
                        return {
                          role:
                            message.role,

                          content:
                            message.content
                        };
                      }
                    )
              })
          }
        );

      const data =
        await response
          .json()
          .catch(
            function () {
              return {};
            }
          );

      if (!response.ok) {
        throw new Error(
          data?.error ||
          text(
            "requestFailed"
          )
        );
      }

      const brain =
        data?.brain &&
        typeof data.brain ===
        "object"
          ? data.brain
          : null;

      let assistantText =
        (
          brain?.answer &&
          String(
            brain.answer
          ).trim()
        ) ||
        (
          data?.message &&
          String(
            data.message
          ).trim()
        ) ||
        text(
          "fallbackAnswer"
        );

      if (
        brain?.followupAction &&
        (
          brain?.intent ===
            "product_action" ||
          brain?.intent ===
            "troubleshooting"
        )
      ) {
        assistantText +=
          "\n\n" +
          text(
            "followupPrefix"
          ) +
          " " +
          String(
            brain.followupAction
          ).trim();
      }

      if (
        brain?.needsConfirmation
      ) {
        assistantText +=
          "\n\n" +
          text(
            "confirmation"
          );
      }

      if (
        brain?.confidence ===
        "low"
      ) {
        assistantText +=
          "\n\n" +
          getLowConfidenceHint(
            brain?.intent ||
            ""
          );
      }

      state.messages.push({
        role:
          "assistant",

        content:
          assistantText
      });
    } catch (error) {
      state.messages.push({
        role:
          "assistant",

        content:
          text(
            "connectionError"
          )
      });

      console.error(
        "[AIVO Assistant Widget Error]",
        error
      );
    } finally {
      setLoading(false);
      renderMessages();
      inputEl.focus();
    }
  }

  launcher.addEventListener(
    "click",
    togglePanel
  );

  closeBtn.addEventListener(
    "click",
    closePanel
  );

  quickButtons.forEach(
    function (button) {
      button.addEventListener(
        "click",
        function () {
          openPanel();

          sendMessage(
            button.getAttribute(
              "data-prompt"
            ) ||
            "",
            {
              intent:
                button.getAttribute(
                  "data-intent"
                ) ||
                "",

              module:
                button.getAttribute(
                  "data-module"
                ) ||
                "",

              action:
                button.getAttribute(
                  "data-action"
                ) ||
                "",

              actionContext:
                button.getAttribute(
                  "data-action-context"
                ) ||
                "",

              source:
                "quick_action_button",

              lang:
                state.lang
            }
          );
        }
      );
    }
  );

  formEl.addEventListener(
    "submit",
    function (event) {
      event.preventDefault();

      sendMessage(
        inputEl.value
      );
    }
  );

  inputEl.addEventListener(
    "input",
    autoResize
  );

  inputEl.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key ===
          "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        sendMessage(
          inputEl.value
        );
      }
    }
  );

  document.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key ===
          "Escape" &&
        state.open
      ) {
        closePanel();
      }
    }
  );

  function handleLanguageChange() {
    applyLanguage();
  }

  document.addEventListener(
    "aivo:language-change",
    handleLanguageChange
  );

  document.addEventListener(
    "aivo:language-changed",
    handleLanguageChange
  );

  window.addEventListener(
    "storage",
    function (event) {
      if (
        LANGUAGE_KEYS.includes(
          event.key
        )
      ) {
        applyLanguage();
      }
    }
  );

  applyLanguage();
})();
