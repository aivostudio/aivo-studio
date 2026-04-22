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
        align-items: flex-end;
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
      <button type="button" class="aivo-assistant-chip" data-prompt="Hangi modül ne işe yarar?">Modülleri Anlat</button>
      <button type="button" class="aivo-assistant-chip" data-prompt="Bana uygun paketi öner.">Paket Öner</button>
      <button type="button" class="aivo-assistant-chip" data-prompt="Kredi sistemi nasıl çalışıyor?">Kredi Sistemi</button>
      <button type="button" class="aivo-assistant-chip" data-prompt="Promptumu güçlendirmeme yardım et.">Prompt Yardımı</button>
      <button type="button" class="aivo-assistant-chip" data-prompt="Sorun yaşıyorum, ne yapmalıyım?">Sorun Çöz</button>
      <button type="button" class="aivo-assistant-chip" data-prompt="İhtiyacıma göre doğru aracı öner.">Doğru Aracı Bul</button>
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
  function detectModuleFromPath() {
    const path = String(window.location.pathname || "").toLowerCase();

    if (path.includes("music")) return "music";
    if (path.includes("cover")) return "cover";
    if (path.includes("atmo") || path.includes("atmosphere")) return "atmo";
    if (path.includes("photofx")) return "photofx";
    if (path.includes("video")) return "video";
    if (path.includes("cartoon") || path.includes("child-cartoon")) return "cartoon";
    if (path.includes("pricing") || path.includes("fiyatlandirma")) return "pricing";

    return "";
  }

  function getBodyText() {
    return String(document.body?.innerText || "");
  }

  function detectActionContext() {
    const text = getBodyText();

    if (/kanal ayırma/i.test(text) && /devam edilsin mi/i.test(text)) {
      return "channel_separation_confirm";
    }

    if (/paketi seç/i.test(text)) {
      return "package_selection";
    }

    if (/mastering/i.test(text)) {
      return "mastering";
    }

    return "";
  }

  function detectCurrentPanel() {
    const path = String(window.location.pathname || "").toLowerCase();
    return path.replace(/\//g, "") || "unknown";
  }

  function detectCurrentCardType() {
    const text = getBodyText();

    if (/kanal ayırma/i.test(text)) return "music_card";

    if (
      /Yeni Kullanıcı/i.test(text) ||
      /Standart Paket/i.test(text) ||
      /Yaratıcı Üretici/i.test(text) ||
      /Stüdyo \/ Ajans/i.test(text)
    ) {
      return "pricing_card";
    }

    return "";
  }

  function detectSelectedItemType() {
    const text = getBodyText();

    if (/kanal ayırma/i.test(text)) return "music_track";
    if (/paketi seç/i.test(text)) return "pricing_package";

    return "";
  }

  function detectLastJobStatus() {
    const text = getBodyText();

    if (/hazır/i.test(text)) return "ready";
    if (/processing|hazırlanıyor|işleniyor/i.test(text)) return "processing";
    if (/hata|başarısız/i.test(text)) return "failed";

    return "";
  }

  function detectUserCredits() {
    const text = getBodyText();
    const match = text.match(/Kredi\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function detectCreditsNeeded() {
    const text = getBodyText();

    if (/Onayla\s*\(\s*5\s*Kredi\s*\)/i.test(text)) return 5;

    const match = text.match(/(\d+)\s*kredi/i);
    return match ? Number(match[1]) : null;
  }

  function detectHasSelection() {
    const text = getBodyText();

    if (/kanal ayırma/i.test(text)) return true;
    if (/Onayla\s*\(\s*5\s*Kredi\s*\)/i.test(text)) return true;

    return null;
  }

  function detectAvailableActions() {
    const text = getBodyText();
    const actions = [];

    if (/kanal ayırma/i.test(text)) actions.push("channel_separation");
    if (/mastering/i.test(text)) actions.push("mastering");
    if (/paketi seç/i.test(text)) actions.push("package_select");
    if (/indir/i.test(text)) actions.push("download");
    if (/dışa aktar|export/i.test(text)) actions.push("export");

    return actions;
  }

  function detectVisibleModals() {
    const text = getBodyText();
    const modals = [];

    if (/kanal ayırma/i.test(text) && /devam edilsin mi/i.test(text)) {
      modals.push("channel_separation_confirm");
    }

    return modals;
  }

  function detectCurrentProductCards() {
    const text = getBodyText();
    const cards = [];

    if (/Yeni Kullanıcı/i.test(text) && /25 kredi/i.test(text) && /199₺/i.test(text)) {
      cards.push({ key: "starter", label: "Yeni Kullanıcı", priceTRY: 199, credits: 25 });
    }

    if (/Standart Paket/i.test(text) && /100 kredi/i.test(text) && /699₺/i.test(text)) {
      cards.push({ key: "standard", label: "Standart Paket", priceTRY: 699, credits: 100 });
    }

    if (/Yaratıcı Üretici/i.test(text) && /200 kredi/i.test(text) && /1\.299₺/i.test(text)) {
      cards.push({ key: "pro", label: "Yaratıcı Üretici", priceTRY: 1299, credits: 200 });
    }

    if (/Stüdyo \/ Ajans/i.test(text) && /500 kredi/i.test(text) && /2\.999₺/i.test(text)) {
      cards.push({ key: "studio", label: "Stüdyo / Ajans", priceTRY: 2999, credits: 500 });
    }

    return cards;
  }

  async function sendMessage(text) {
    const content = String(text || "").trim();
    if (!content || state.loading) return;
  async function sendMessage(text) {
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
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
             body: JSON.stringify({
          page: window.location.pathname,
          module: detectModuleFromPath(),
          actionContext: detectActionContext(),
          currentPanel: detectCurrentPanel(),
          currentCardType: detectCurrentCardType(),
          selectedItemType: detectSelectedItemType(),
          lastJobStatus: detectLastJobStatus(),
          userCredits: detectUserCredits(),
          creditsNeeded: detectCreditsNeeded(),
          hasSelection: detectHasSelection(),
          availableActions: detectAvailableActions(),
          visibleModals: detectVisibleModals(),
          currentProductCards: detectCurrentProductCards(),
          uiState: {
            title: document.title || "",
            pathname: window.location.pathname || "",
            bodyText: getBodyText().slice(0, 4000)
          },
          message: content,
          messages: state.messages
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "İstek başarısız oldu.");
      }

      state.messages.push({
        role: "assistant",
        content: data?.message || "Şu anda cevap üretilemedi."
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
      sendMessage(button.getAttribute("data-prompt") || "");
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
