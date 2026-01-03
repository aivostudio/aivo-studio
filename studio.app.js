/* =========================================================
   AIVO STUDIO — APP LAYER (PROD)
   ---------------------------------------------------------
   Amaç:
   - UI’dan gelen generate aksiyonlarını yönetir
   - Consume + job create server-side yapılır
   - UI asla lokal kredi düşürmez
   - Idempotent (job_id korumalı)

   KRİTİK KURAL:
   UI kredi düşüşü = server ok:true
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     Utils
  --------------------------------------------------------- */

  function generateJobId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function lockButton(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add("is-loading");
  }

  function unlockButton(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove("is-loading");
  }

  function toast(msg, type) {
    if (window.showToast) {
      window.showToast(msg, type || "ok");
    }
  }

  /* ---------------------------------------------------------
     MUSIC GENERATE (PROD)
     - Tek çağrı
     - /api/music/generate
  --------------------------------------------------------- */

  async function aivoGenerateMusic(params) {
    const btn = params.buttonEl;
    const job_id = generateJobId();

    lockButton(btn);

    try {
      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.email,              // STORE’dan gelir
          job_id: job_id,

          // job payload
          prompt: params.prompt || "",
          mode: params.mode || "instrumental",
          duration_sec: params.durationSec || 30,
          quality: params.quality || "standard",
        }),
      });

      const data = await res.json();

      // ❌ Başarısız
      if (!data || !data.ok) {
        if (data && data.error === "insufficient_credits") {
          toast("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
          if (window.AIVO_PRICING && AIVO_PRICING.open) {
            AIVO_PRICING.open();
          }
          return;
        }

        toast("İş başlatılamadı.", "error");
        return;
      }

      // ✅ Başarılı → UI STORE güncelle
      if (
        window.AIVO_STORE_V1 &&
        typeof AIVO_STORE_V1.setCredits === "function" &&
        Number.isFinite(data.credits)
      ) {
        AIVO_STORE_V1.setCredits(data.credits);
      }

      toast("Müzik üretim işi sıraya alındı.", "ok");

      // Job UI (varsa)
      if (window.AIVO_JOBS && typeof AIVO_JOBS.add === "function") {
        AIVO_JOBS.add({
          job_id: data.job_id,
          status: data.status || "queued",
          type: "music",
        });
      }

      return data;
    } catch (err) {
      console.error("[AIVO][music_generate]", err);
      toast("Sunucu hatası.", "error");
    } finally {
      unlockButton(btn);
    }
  }

  /* ---------------------------------------------------------
     GLOBAL EXPORT
     (başka dosyalar buradan çağırır)
  --------------------------------------------------------- */

  window.AIVO_APP = window.AIVO_APP || {};
  window.AIVO_APP.generateMusic = aivoGenerateMusic;

})();
  /* ---------------------------------------------------------
     BIND UI (MUSIC GENERATE BUTTON)
     - #musicGenerateBtn tıklanınca AIVO_APP.generateMusic çağrılır
     - Tek kez bağlanır
  --------------------------------------------------------- */

  (function bindGenerateOnce() {
    if (window.__aivoGenerateBound) return;
    window.__aivoGenerateBound = true;

    function getEmailSafe() {
      // 1) store üzerinden dene
      try {
        if (window.AIVO_STORE_V1) {
          if (typeof AIVO_STORE_V1.getUser === "function") {
            const u = AIVO_STORE_V1.getUser();
            if (u && u.email) return String(u.email).trim().toLowerCase();
          }
          if (typeof AIVO_STORE_V1.get === "function") {
            const s = AIVO_STORE_V1.get();
            if (s && s.email) return String(s.email).trim().toLowerCase();
          }
        }
      } catch (_) {}

      // 2) localStorage fallback
      try {
        const raw = localStorage.getItem("aivo_user") || localStorage.getItem("user") || "";
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && obj.email) return String(obj.email).trim().toLowerCase();
        }
      } catch (_) {}

      return "";
    }

    function val(sel) {
      const el = document.querySelector(sel);
      return el ? String(el.value || "").trim() : "";
    }

    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("#musicGenerateBtn, [data-generate='music']");
      if (!btn) return;

      // Eski handler'ların “local kredi düşürme” akışını ezmek için:
      e.preventDefault();
      e.stopPropagation();

      if (!window.AIVO_APP || typeof window.AIVO_APP.generateMusic !== "function") {
        if (window.toast) toast("AIVO_APP hazır değil (studio.app.js yüklenmedi).", "error");
        return;
      }

      const email = getEmailSafe();
      if (!email) {
        if (window.toast) toast("Email bulunamadı. Giriş/Store kontrol.", "error");
        return;
      }

      // Form alanlarını kendi selector’larınla eşleştiriyoruz:
      // (Şu an güvenli fallback: boşsa yine çalışır.)
      const prompt =
        val("#musicPrompt") ||
        val("textarea[name='prompt']") ||
        val("#prompt") ||
        val("#musicExtraPrompt") ||
        "";

      const mode =
        val("#musicMode") ||
        val("select[name='mode']") ||
        "instrumental";

      const quality =
        val("#musicQuality") ||
        val("select[name='quality']") ||
        "standard";

      const durationSecRaw =
        val("#musicDuration") ||
        val("select[name='duration']") ||
        "30";

      const durationSec = Math.max(5, Number(durationSecRaw || 30) || 30);

      // ✅ tek çağrı: server consume + job create
      await window.AIVO_APP.generateMusic({
        buttonEl: btn,
        email,
        prompt,
        mode,
        durationSec,
        quality
      });
    }, true); // capture=true: studio.js'teki eski delegated handler'dan önce yakalar
  })();

/* ---------------------------------------------------------
   BIND MUSIC GENERATE BUTTON (PROD)
--------------------------------------------------------- */
document.addEventListener("click", function (e) {
  const btn = e.target.closest("#musicGenerateBtn");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  if (!window.AIVO_APP || typeof window.AIVO_APP.generateMusic !== "function") {
    console.warn("[AIVO] generateMusic not ready");
    return;
  }

  window.AIVO_APP.generateMusic({
    buttonEl: btn,
    email: window.AIVO_STORE_V1?.getEmail?.(),
    prompt: document.querySelector("[name='prompt']")?.value || "",
    mode: "instrumental",
    durationSec: 30
  });
});
/* =========================================================
   DEBUG BIND — JOB UI TEST (MUTLAK)
   - studio.app.js yüklendi mi?
   - buton click geliyor mu?
   - AIVO_JOBS var mı?
   ========================================================= */
(function () {
  try {
    console.log("[AIVO][app] LOADED ✅", new Date().toISOString());
  } catch (_) {}

  function forceBadge(text) {
    let c = document.getElementById("aivo-jobs");
    if (!c) {
      c = document.createElement("div");
      c.id = "aivo-jobs";
      c.style.position = "fixed";
      c.style.top = "90px";
      c.style.right = "20px";
      c.style.zIndex = "2147483647";
      c.style.display = "flex";
      c.style.flexDirection = "column";
      c.style.gap = "10px";
      document.body.appendChild(c);
    }

    const el = document.createElement("div");
    el.style.padding = "10px 12px";
    el.style.borderRadius = "12px";
    el.style.background = "rgba(20,20,30,.95)";
    el.style.color = "#fff";
    el.style.fontSize = "13px";
    el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
    el.style.outline = "2px solid lime";
    el.textContent = text;
    c.appendChild(el);
  }

  // Tek kez bağlan
  if (window.__aivoJobClickTestBound) return;
  window.__aivoJobClickTestBound = true;

  document.addEventListener(
    "click",
    function (e) {
      const btn = e.target.closest("#musicGenerateBtn");
      if (!btn) return;

      console.log("[AIVO][app] musicGenerateBtn CLICK ✅");

      // Önce UI’yı ZORLA göster (API olmasa bile)
      if (window.AIVO_JOBS && typeof window.AIVO_JOBS.add === "function") {
        window.AIVO_JOBS.add({ job_id: "UI-CLICK-" + Date.now(), type: "music", status: "queued" });
      } else {
        console.warn("[AIVO][app] AIVO_JOBS YOK -> badge fallback");
        forceBadge("music • queued");
      }
    },
    true // capture: eski handler yutsa bile önce yakalar
  );
})();
/* studio.app.js — GENERATE ROUTER (NO studio.js changes) */
(function () {
  "use strict";
  if (window.__AIVO_APP_ROUTER_BOUND) return;
  window.__AIVO_APP_ROUTER_BOUND = true;

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest("[data-generate]");
    if (!btn) return;

    // Legacy studio.js handler'larını bypass et
    e.preventDefault();
    e.stopImmediatePropagation();

    var action = (btn.getAttribute("data-generate") || "").trim();
    if (!action) return;

    // 1) Job UI — anında göster
    try {
      if (window.AIVO_JOBS && typeof window.AIVO_JOBS.add === "function") {
        var jid = action + "--" + Date.now();
        window.AIVO_JOBS.add({ job_id: jid, type: action, status: "queued" });
      }
    } catch (err) {}

    // 2) Kredi harcatma (senin mevcut spend bloğunu burada çağıracağız)
    // Örn: window.AIVO_SPEND(action, btn) gibi
    // Şimdilik sadece log:
    console.log("[AIVO APP] generate:", action);
  }, true);
})();
