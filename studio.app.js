/* =========================================================
   AIVO APP — CORE (minimum)
   - AIVO_APP yoksa oluştur
   - generateMusic: şimdilik sadece Job UI ekler (backend yok)
   - job_id çakışmasını önlemek için seq + random eklenir
   ========================================================= */

window.AIVO_APP = window.AIVO_APP || {};
window.__aivoJobSeq = window.__aivoJobSeq || 0;

window.AIVO_APP.generateMusic = async function (opts) {
  try {
    window.__aivoJobSeq += 1;

    var rand = Math.random().toString(36).slice(2, 7);
    var jid = "music--" + Date.now() + "--" + window.__aivoJobSeq + "--" + rand;

    if (window.AIVO_JOBS && typeof window.AIVO_JOBS.add === "function") {
      window.AIVO_JOBS.add({
        job_id: jid,
        type: "music",
        status: "queued"
      });
    } else {
      console.warn("[AIVO_APP] AIVO_JOBS.add yok");
    }

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

  // (opsiyonel) Jobs inline "outline: lime" ezecek mini CSS (tek blok içinde)
  (function injectJobsOutlineFixOnce(){
    if (window.__aivoJobsOutlineFixInjected) return;
    window.__aivoJobsOutlineFixInjected = true;
    try{
      var css =
        "[id^='aivo-jobs-']{outline:none !important;}" +
        "[id^='aivo-jobs-']{box-shadow:0 0 0 2px rgba(154,122,255,.35) !important;}";
      var st = document.createElement("style");
      st.setAttribute("data-aivo", "jobs-outline-fix");
      st.appendChild(document.createTextNode(css));
      document.head.appendChild(st);
    }catch(_){}
  })();

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

    // 3) DOM fallback (opsiyonel)
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
      // DÜZELTİLDİ: iki olası id + data-generate='music'
      // (sende bazen id musicGenerateBtn, bazen musicGenerateBtn)
      var btn =
        e.target &&
        e.target.closest &&
        e.target.closest("#musicGenerateBtn, #musicGenerateBtn, [data-generate='music']");

      if (!btn) return;

      // legacy studio.js handler'larını kesin bypass
      e.preventDefault();
      e.stopImmediatePropagation();

      if (!window.AIVO_APP || typeof window.AIVO_APP.generateMusic !== "function") {
        toastSafe("AIVO_APP hazır değil (studio.app.js).", "error");
        return;
      }

      // Email BLOKLAYICI değil. Yoksa 1 kez 'ok' toast atıp sus.
      var email = getEmailSafe();
      if (!email && !window.__aivoEmailWarned) {
        window.__aivoEmailWarned = true;
        toastSafe("Oturum email'i okunamadı. Şimdilik sadece Job UI gösteriliyor.", "ok");
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
