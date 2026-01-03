/* =========================================================
   AIVO APP — CORE (minimum)
   - AIVO_APP yoksa oluştur
   - generateMusic: şimdilik sadece Job UI ekler (backend yok)
   ========================================================= */

window.AIVO_APP = window.AIVO_APP || {};

window.AIVO_APP.generateMusic = async function (opts) {
  try {
    var jid = "music--" + Date.now();

    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.add === "function") {
      window.AIVO_JOBS.add({
        job_id: jid,
        type: "music",
        status: "queued"
      });
      console.log("[AIVO_APP] job added:", jid);
    } else {
      console.warn("[AIVO_APP] AIVO_JOBS.add yok");
    }

    // Backend yok: burada duruyoruz.
    return { ok: true, job_id: jid };
  } catch (e) {
    console.error("[AIVO_APP] generateMusic error", e);
    return { ok: false, error: String(e) };
  }
};

/* =========================================================
   AIVO APP — UI BIND (MUSIC GENERATE BUTTON)
   - #musicGenerateBtn veya #musicGenerateBtn tıklanınca job ekler
   - Tek kez bağlanır
   - Legacy studio.js handler’larını capture + stopImmediatePropagation ile bypass eder
   ========================================================= */

(function bindGenerateOnce() {
  if (window.__aivoGenerateBound) return;
  window.__aivoGenerateBound = true;

  function toastSafe(msg, type) {
    if (typeof window.showToast === "function") window.showToast(msg, type || "ok");
    else console.log("[toast]", type || "ok", msg);
  }

  function getEmailSafe() {
    // 1) Store
    try {
      if (window.AIVO_STORE_V1) {
        if (typeof window.AIVO_STORE_V1.getUser === "function") {
          var u = window.AIVO_STORE_V1.getUser();
          if (u && u.email) return String(u.email).trim().toLowerCase();
        }
        if (typeof window.AIVO_STORE_V1.get === "function") {
          var s = window.AIVO_STORE_V1.get();
          if (s && s.email) return String(s.email).trim().toLowerCase();
        }
      }
    } catch (_) {}

    // 2) localStorage
    try {
      var raw =
        localStorage.getItem("aivo_user") ||
        localStorage.getItem("aivoUser") ||
        localStorage.getItem("user") ||
        localStorage.getItem("auth_user") ||
        "";
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && obj.email) return String(obj.email).trim().toLowerCase();
      }
    } catch (_) {}

    // 3) DOM fallback (ileride eklenebilir)
    try {
      var be = document.body && document.body.getAttribute && document.body.getAttribute("data-email");
      if (be) return String(be).trim().toLowerCase();
    } catch (_) {}

    return "";
  }

  function val(sel) {
    var el = document.querySelector(sel);
    return el ? String(el.value || "").trim() : "";
  }

  document.addEventListener(
    "click",
    async function (e) {
      // ID'ler: sende bazen musicGenerateBtn, bazen musicGenerateBtn diye farklı yazılmış olabiliyor.
      // Bu yüzden ikisini de kapsıyoruz + data-generate='music'
      var btn =
        e.target &&
        e.target.closest &&
        e.target.closest("#musicGenerateBtn, #musicGenerateBtn, [data-generate='music']");

      if (!btn) return;

      // legacy studio.js handler'larını kesin bypass
      e.preventDefault();
      e.stopImmediatePropagation();

      // Debug: click geldi mi?
      console.log("[AIVO_APP] click:", btn.id, btn.getAttribute("data-generate"));

      if (!window.AIVO_APP || typeof window.AIVO_APP.generateMusic !== "function") {
        toastSafe("AIVO_APP hazır değil (studio.app.js).", "error");
        return;
      }

      // Email artık BLOKLAYICI değil: yoksa sadece uyarır, yine de job ekler.
      var email = getEmailSafe();
      if (!email) {
        toastSafe("Email bulunamadı (şimdilik sorun değil). Job UI gösteriliyor.", "error");
      }

      var prompt = val("#musicPrompt") || val("textarea[name='prompt']") || val("#prompt") || "";

      var mode = val("#musicMode") || "instrumental";
      var quality = val("#musicQuality") || "standard";
      var durationSec = Math.max(5, Number(val("#musicDuration") || "30") || 30);

      await window.AIVO_APP.generateMusic({
        buttonEl: btn,
        email: email || "",
        prompt: prompt,
        mode: mode,
        durationSec: durationSec,
        quality: quality
      });
    },
    true // capture=true
  );
})();
