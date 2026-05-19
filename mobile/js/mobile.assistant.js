(function () {
  const existingLauncher = document.querySelector(".aivo-assistant-launcher");
  const existingPanel = document.querySelector(".aivo-assistant-panel");

  if (window.__AIVO_MOBILE_ASSISTANT__ && existingLauncher && existingPanel) return;

  if (window.__AIVO_MOBILE_ASSISTANT__ && (!existingLauncher || !existingPanel)) {
    window.__AIVO_MOBILE_ASSISTANT__ = false;
  }

  // 🔒 AUTH CHECK – auth henüz yazılmadıysa auth-ready event'ini bekle
  const hasSession =
    localStorage.getItem("aivo_auth_unified_v1") ||
    localStorage.getItem("aivo_token") ||
    document.cookie.includes("aivo_sess") ||
    document.cookie.includes("aivo_session");

  if (!hasSession) {
    if (!window.__AIVO_MOBILE_ASSISTANT_WAITING_AUTH__) {
      window.__AIVO_MOBILE_ASSISTANT_WAITING_AUTH__ = true;

      document.addEventListener("aivo:auth-ready", function(){
        window.__AIVO_MOBILE_ASSISTANT_WAITING_AUTH__ = false;
        window.__AIVO_MOBILE_ASSISTANT__ = false;

        const script = document.createElement("script");
        script.src = "/mobile/js/mobile.assistant.js?v=4";
        script.defer = true;
        document.body.appendChild(script);
      }, { once: true });
    }

    return;
  }

  window.__AIVO_MOBILE_ASSISTANT__ = true;
    function tt(key, fallback){
    try {
      if (typeof window.t === "function") {
        return window.t(key);
      }
    } catch (_) {}

    return fallback;
  }



  const state = {
    open: false,
    loading: false,
    messages: [
      {
        role: "assistant",
        content:
          tt("assistant.welcome", "Merhaba, ben AIVO yardımcı asistanıyım. İstersen modüller, paket seçimi, kredi sistemi, prompt yazımı ya da yaşadığın bir sorunda sana adım adım yardımcı olayım. Ne yapmak istiyorsun?")
      }
    ]
  };
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "aivo-assistant-launcher";
  launcher.textContent = tt("assistant.launcher", "AI Yardım");
  const panel = document.createElement("section");
  panel.className = "aivo-assistant-panel";
  panel.innerHTML = `
    <div class="aivo-assistant-header">
      <div class="aivo-assistant-title-wrap">
       <h3 class="aivo-assistant-title">${tt("assistant.title", "AIVO AI Yardım")}</h3>
        <p class="aivo-assistant-subtitle">${tt("assistant.subtitle", "Hızlı yönlendirme, paket, kredi ve prompt desteği")}</p>
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
      >${tt("assistant.quick.modules", "Modülleri Anlat")}</button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="Bana uygun paketi öner."
        data-intent="pricing_guidance"
        data-module="pricing"
        data-action="package_select"
        data-action-context="quick_pricing_recommendation"
      >${tt("assistant.quick.package", "Paket Öner")}</button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="Kredi sistemi nasıl çalışıyor?"
        data-intent="pricing_guidance"
        data-module="pricing"
        data-action="credit_info"
        data-action-context="quick_credit_info"
      >${tt("assistant.quick.credits", "Kredi Sistemi")}</button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="Fikrimi güçlü, üretime hazır bir prompta çevir. Gerekirse eksikleri tamamla, modüle uygun yaz ve bana direkt kullanabileceğim en güçlü promptu ver."
        data-intent="prompt_help"
        data-module=""
        data-action="prompt_help"
        data-action-context="quick_prompt_help_max"
      >${tt("assistant.quick.prompt", "Prompt Güçlendir")}</button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="Sorun yaşıyorum, ne yapmalıyım?"
        data-intent="troubleshooting"
        data-module=""
        data-action="troubleshoot"
        data-action-context="quick_troubleshoot"
      >${tt("assistant.quick.problem", "Sorun Çöz")}</button>

      <button
        type="button"
        class="aivo-assistant-chip"
        data-prompt="İhtiyacıma göre doğru aracı öner."
        data-intent="module_selection"
        data-module=""
        data-action="recommend_module"
        data-action-context="quick_tool_finder"
      >${tt("assistant.quick.tool", "Doğru Aracı Bul")}</button>
    </div>

    <div class="aivo-assistant-messages" id="aivo-assistant-messages"></div>

    <form class="aivo-assistant-form" id="aivo-assistant-form">
      <textarea
        class="aivo-assistant-input"
        id="aivo-assistant-input"
        placeholder="${tt("assistant.placeholder", "Sorunu ya da yapmak istediğini yaz...")}"
        rows="1"
        spellcheck="false"
      ></textarea>
           <button type="submit" class="aivo-assistant-send" id="aivo-assistant-send">
        ${tt("assistant.send", "Gönder")}
      </button>
    </form>
  `;

  const mobileAssistantRoot =
    document.getElementById("mobileAssistantRoot") ||
    document.body;

  mobileAssistantRoot.appendChild(launcher);
  mobileAssistantRoot.appendChild(panel);

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
    sendEl.textContent = isLoading
      ? tt("assistant.wait", "Bekle...")
      : tt("assistant.send", "Gönder");
  }
  function openPanel() {
    state.open = true;
    panel.classList.add("is-open");

    requestAnimationFrame(() => {
      autoResize();
      inputEl.focus();
    });
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
    inputEl.style.height = "44px";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 104) + "px";
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

  function detectActiveAssistantModuleFromDOM() {
    const cartoonRoot =
      document.querySelector('.main-panel[data-module="cartoon"]') ||
      document.querySelector('[data-module="cartoon"]');

    if (cartoonRoot) {
      const activeCartoonView =
        cartoonRoot.querySelector('.cartoon-mode-view.is-active[data-cartoon-view]') ||
        Array.from(cartoonRoot.querySelectorAll('[data-cartoon-view]')).find((el) => !el.hidden) ||
        null;

      const cartoonView = String(activeCartoonView?.getAttribute("data-cartoon-view") || "").trim();

      return {
        module: "cartoon",
        actionContext:
          cartoonView === "character" ? "cartoon_character" :
          cartoonView === "basic" ? "cartoon_basic" :
          cartoonView === "story" ? "cartoon_story" :
          cartoonView === "studio" ? "cartoon_studio" :
          "cartoon"
      };
    }

    const photoFxRoot =
      document.querySelector('.main-panel[data-module="photofx"]') ||
      document.querySelector('[data-module="photofx"]');

    if (photoFxRoot) {
      return {
        module: "photofx",
        actionContext: "photofx"
      };
    }

    const videoRoot =
      document.querySelector('section[data-module="video"]') ||
      document.querySelector('.main-panel[data-module="video"]') ||
      document.querySelector('[data-module="video"]');

    if (videoRoot) {
      return {
        module: "video",
        actionContext: "video"
      };
    }

    const atmoRoot =
      document.querySelector('.main-panel[data-module="atmo"]') ||
      document.querySelector('[data-module="atmo"]');

    if (atmoRoot) {
      return {
        module: "atmo",
        actionContext: "atmo"
      };
    }

    const coverRoot =
      document.querySelector('.main-panel[data-module="cover"]') ||
      document.querySelector('[data-module="cover"]');

    if (coverRoot) {
      return {
        module: "cover",
        actionContext: "cover"
      };
    }

    const musicRoot =
      document.querySelector('.main-panel[data-module="music"]') ||
      document.querySelector('[data-module="music"]');

    if (musicRoot) {
      return {
        module: "music",
        actionContext: "music"
      };
    }

    return {
      module: "",
      actionContext: ""
    };
  }

  function buildAssistantContext(extraContext = {}) {
    const pathname = getPathname();
    const bodyText = getBodyText();
    const runtime = readWindowRuntimeState();
    const domDetected = detectActiveAssistantModuleFromDOM();

      const context = {
      page: pathname,
      language:
        typeof window.AIVO_LANG === "string"
          ? window.AIVO_LANG
          : localStorage.getItem("aivo_mobile_language") || "tr",
      module: domDetected.module || "",
      intent: extraContext.intent || "",
      action: extraContext.action || "",
      actionContext: extraContext.actionContext || domDetected.actionContext || "",
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
        context.module ||
        (typeof runtime.module === "string" ? runtime.module : context.module);

      context.actionContext =
        context.actionContext ||
        (typeof runtime.actionContext === "string" ? runtime.actionContext : "") ||
        domDetected.actionContext ||
        "";

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

      if (/Yaratıcı Üretici/i.test(bodyText) && /200 kredi/i.test(bodyText) && /1\\.299₺/i.test(bodyText)) {
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

      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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
        "Şu an net bir cevap oluşturamadım ama istersen fikrini birlikte güçlü ve üretime hazır bir prompta çevirebiliriz.";
        if (
  brain?.followupAction &&
  (brain?.intent === "product_action" || brain?.intent === "troubleshooting")
) {
  assistantText += `

Buradan devam etmek için en net adım: ${brain.followupAction}`;
}

      if (brain?.needsConfirmation) {
        assistantText += `

Devam etmeden önce bu işlem için onay gerekiyor.`;
      }

       if (brain?.confidence === "low") {
        let hintText =
          "Sana daha net yardımcı olabilmem için bulunduğun ekranı ya da yapmak istediğin şeyi biraz daha açık yazabilir misin?";

        if (brain?.intent === "pricing_guidance") {
          hintText =
            "Sana daha doğru paket önerebilmem için ne üretmek istediğini ve ne sıklıkla kullanacağını kısa yazabilir misin?";
        } else if (brain?.intent === "troubleshooting") {
          hintText =
            "Bunu birlikte netleştirelim: hangi modüldesin ve ekranda tam olarak ne görüyorsun, kısa yazman yeterli.";
        } else if (brain?.intent === "prompt_help") {
          hintText =
            "Ne üretmek istediğini tek cümleyle yaz. Ben onu senin için güçlü, detaylı, modüle uygun ve direkt kullanılabilir bir prompta çevireyim. İstersen stil, atmosfer, karakter, renk, kamera açısı, kalite ve duygu tonunu da birlikte kurarım.";
        } else if (brain?.intent === "module_selection") {
          hintText =
            "Sana doğru modülü önermem için üretmek istediğin içeriği kısaca yazabilir misin?";
        } else if (brain?.intent === "product_action") {
          hintText =
            "Sana doğru adımı söyleyebilmem için bulunduğun ekranı, kartı ya da menüyü biraz daha net tarif etmen yeterli.";
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
          "Şu anda yardımcı asistana bağlanırken küçük bir sorun oluştu. Birkaç saniye sonra tekrar dener misin?"
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
