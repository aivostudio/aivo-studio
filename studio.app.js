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
