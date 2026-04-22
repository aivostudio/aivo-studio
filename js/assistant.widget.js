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
        right: 22px;
        bottom: 22px;
        z-index: 9999;
        border: 1px solid rgba(255,255,255,.16);
        background: linear-gradient(135deg, #7c4dff 0%, #ff4fa3 100%);
        color: #fff;
        border-radius: 999px;
        padding: 14px 18px;
        font: 600 14px/1.1 Inter, Arial, sans-serif;
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        cursor: pointer;
        transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
      }

      .aivo-assistant-launcher:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 38px rgba(0,0,0,.42);
      }

      .aivo-assistant-panel {
        position: fixed;
        right: 22px;
        bottom: 82px;
        z-index: 9999;
        width: 380px;
        max-width: calc(100vw - 24px);
        height: 580px;
        max-height: calc(100vh - 120px);
        display: none;
        flex-direction: column;
        overflow: hidden;
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,.10);
        background:
          radial-gradient(circle at top left, rgba(124,77,255,.18), transparent 35%),
          radial-gradient(circle at top right, rgba(255,79,163,.16), transparent 30%),
          rgba(10,10,18,.96);
        box-shadow: 0 18px 60px rgba(0,0,0,.45);
        backdrop-filter: blur(12px);
      }

      .aivo-assistant-panel.is-open {
        display: flex;
      }

      .aivo-assistant-header {
        padding: 16px 16px 14px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .aivo-assistant-title-wrap {
        min-width: 0;
      }

      .aivo-assistant-title {
        margin: 0;
        color: #fff;
        font: 700 16px/1.2 Inter, Arial, sans-serif;
      }

      .aivo-assistant-subtitle {
        margin: 6px 0 0;
        color: rgba(255,255,255,.65);
        font: 400 12px/1.4 Inter, Arial, sans-serif;
      }

      .aivo-assistant-close {
        border: 0;
        background: rgba(255,255,255,.08);
        color: #fff;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      }

      .aivo-assistant-quick {
        padding: 12px 14px 0;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .aivo-assistant-chip {
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.06);
        color: #fff;
        border-radius: 999px;
        padding: 8px 10px;
        cursor: pointer;
        font: 500 12px/1.1 Inter, Arial, sans-serif;
      }

      .aivo-assistant-messages {
        flex: 1;
        overflow: auto;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .aivo-assistant-message {
        max-width: 88%;
        padding: 11px 12px;
        border-radius: 16px;
        white-space: pre-wrap;
        word-break: break-word;
        font: 400 14px/1.5 Inter, Arial, sans-serif;
      }

      .aivo-assistant-message.user {
        align-self: flex-end;
        background: linear-gradient(135deg, #7c4dff 0%, #ff4fa3 100%);
        color: #fff;
        border-bottom-right-radius: 6px;
      }

      .aivo-assistant-message.assistant {
        align-self: flex-start;
        background: rgba(255,255,255,.08);
        color: #f5f7ff;
        border: 1px solid rgba(255,255,255,.06);
        border-bottom-left-radius: 6px;
      }

      .aivo-assistant-message.system {
        align-self: center;
        background: transparent;
        color: rgba(255,255,255,.55);
        font-size: 12px;
        padding: 2px 8px;
      }

      .aivo-assistant-form {
        padding: 14px;
        border-top: 1px solid rgba(255,255,255,.08);
        display: flex;
        gap: 10px;
      }

      .aivo-assistant-input {
        flex: 1;
        min-width: 0;
        resize: none;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.06);
        color: #fff;
        border-radius: 14px;
        padding: 12px 14px;
        outline: none;
        min-height: 46px;
        max-height: 120px;
        font: 400 14px/1.45 Inter, Arial, sans-serif;
      }

      .aivo-assistant-input::placeholder {
        color: rgba(255,255,255,.40);
      }

      .aivo-assistant-send {
        border: 0;
        min-width: 92px;
        border-radius: 14px;
        background: linear-gradient(135deg, #7c4dff 0%, #ff4fa3 100%);
        color: #fff;
        padding: 0 16px;
        font: 700 14px/1 Inter, Arial, sans-serif;
        cursor: pointer;
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
          bottom: 78px;
          width: auto;
          max-width: none;
          height: 70vh;
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
