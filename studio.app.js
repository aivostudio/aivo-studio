/* =========================================================
   AIVO APP — CORE + BIND (DIAGNOSTIC + CREDIT AUTO-DETECT)
   - Tek dosya / tek blok
   - Click kesin yakalanır (capture)
   - Credits: localStorage içinde "credit" içeren key'lerden otomatik bulur
   - Yetersizse toast + pricing
   - Yeterliyse kredi düşer + UI refresh + Job eklenir
   ========================================================= */

(function () {
  "use strict";

  window.AIVO_APP = window.AIVO_APP || {};
  window.__aivoJobSeq = window.__aivoJobSeq || 0;

  // ---------------------------
  // Helpers
  // ---------------------------
  function toastSafe(msg, type) {
    try {
      if (typeof window.showToast === "function") window.showToast(msg, type || "ok");
      else console.log("[toast]", type || "ok", msg);
    } catch (e) {
      console.log("[toast-fallback]", type || "ok", msg);
    }
  }

  function refreshCreditsUI() {
    try {
      if (typeof window.callCreditsUIRefresh === "function") window.callCreditsUIRefresh();
    } catch (_) {}
    try {
      if (window.AIVO_CREDITS_UI && typeof window.AIVO_CREDITS_UI.refresh === "function") window.AIVO_CREDITS_UI.refresh();
    } catch (_) {}
  }

  function openPricingSafe() {
    try {
      if (typeof window.openPricingIfPossible === "function") window.openPricingIfPossible();
    } catch (_) {}
  }

  function val(sel) {
    var el = document.querySelector(sel);
    return el ? String(el.value || "").trim() : "";
  }

  function getEmailSafe() {
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

    try {
      var be = document.body && document.body.getAttribute && document.body.getAttribute("data-email");
      if (be) return String(be).trim().toLowerCase();
    } catch (_) {}

    return "";
  }

  // ---------------------------
  // CREDIT AUTO-DETECT
  // - localStorage içinde "credit" geçen key'leri tarar
  // - sayısal olanları çıkarır
  // - en yüksek değeri "aktif kredi" kabul eder
  // ---------------------------
  function scanCreditCandidates() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        if (String(k).toLowerCase().indexOf("credit") === -1 && String(k).toLowerCase().indexOf("kredi") === -1) continue;

        var v = localStorage.getItem(k);
        if (v == null) continue;

        // düz sayı
        var n1 = parseInt(v, 10);
        if (Number.isFinite(n1)) {
          out.push({ key: k, value: n1, raw: v });
          continue;
        }

        // json içinde olma ihtimali (örn: {"credits":123})
        try {
          var obj = JSON.parse(v);
          if (obj && typeof obj === "object") {
            var maybe =
              obj.credits ??
              obj.credit ??
              obj.kredi ??
              obj.balance ??
              obj.amount ??
              null;
            if (maybe != null) {
              var n2 = parseInt(maybe, 10);
              if (Number.isFinite(n2)) out.push({ key: k, value: n2, raw: v, json: true });
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
    return out;
  }

  function pickCreditKey() {
    var cands = scanCreditCandidates();
    if (!cands.length) return { key: "", value: 0, candidates: [] };

    // en büyük sayıyı seç
    cands.sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
    return { key: cands[0].key, value: cands[0].value || 0, candidates: cands };
  }

  function writeCreditsToKey(key, newValue) {
    try {
      var nn = Math.max(0, (newValue | 0));
      var old = localStorage.getItem(key);

      // JSON ise içinden güncelle
      try {
        var obj = JSON.parse(old);
        if (obj && typeof obj === "object") {
          if ("credits" in obj) obj.credits = nn;
          else if ("credit" in obj) obj.credit = nn;
          else if ("kredi" in obj) obj.kredi = nn;
          else obj.credits = nn;
          localStorage.setItem(key, JSON.stringify(obj));
          return true;
        }
      } catch (_) {}

      // düz sayı
      localStorage.setItem(key, String(nn));
      return true;
    } catch (_) {
      return false;
    }
  }

  // ---------------------------
  // JOB UI (stub)
  // ---------------------------
  window.AIVO_APP.generateMusic = async function (opts) {
    try {
      window.__aivoJobSeq += 1;
      var rand = Math.random().toString(36).slice(2, 7);
      var jid = "music--" + Date.now() + "--" + window.__aivoJobSeq + "--" + rand;

      if (window.AIVO_JOBS && typeof window.AIVO_JOBS.add === "function") {
        window.AIVO_JOBS.add({ job_id: jid, type: "music", status: "queued" });
        console.log("[AIVO_APP] job added:", jid);
      } else {
        console.warn("[AIVO_APP] AIVO_JOBS.add yok. window.AIVO_JOBS=", window.AIVO_JOBS);
        return { ok: false, error: "AIVO_JOBS.add_missing" };
      }

      return { ok: true, job_id: jid };
    } catch (e) {
      console.error("[AIVO_APP] generateMusic error", e);
      return { ok: false, error: String(e) };
    }
  };

  // ---------------------------
  // Bind click (capture)
  // ---------------------------
  if (window.__aivoGenerateBound) return;
  window.__aivoGenerateBound = true;

  document.addEventListener(
    "click",
    async function (e) {
      var btn = e.target && e.target.closest && e.target.closest(
        "#musicGenerateBtn, [data-generate='music'], [data-generate^='music'], button[data-page='music'], button[data-action='music']"
      );
      if (!btn) return;

      // her durumda debug log
      console.log("[AIVO_APP] CLICK CAPTURED", {
        id: btn.id,
        dataGenerate: btn.getAttribute("data-generate"),
        className: btn.className
      });

      // legacy bypass
      e.preventDefault();
      e.stopImmediatePropagation();

      // email uyarısı (bloklamaz)
      var email = getEmailSafe();
      if (!email && !window.__aivoEmailWarned) {
        window.__aivoEmailWarned = true;
        toastSafe("Oturum email'i okunamadı. Şimdilik test modunda.", "ok");
      }

      // cost
      var COST = 5;
      try {
        var dc = btn.getAttribute("data-credit-cost");
        if (dc != null && dc !== "") COST = Math.max(1, Number(dc) || COST);
      } catch (_) {}

      // kredi anahtarını bul
      var pick = pickCreditKey();
      console.log("[AIVO_APP] CREDIT PICK", pick);

      // hiç bulamazsak: bu yüzden "yetersiz" görüyorsun.
      if (!pick.key) {
        toastSafe("Kredi anahtarı bulunamadı (localStorage). Yetersiz kredi gibi görünüyor.", "error");
        // pricing açmayı dene ama job ekleme (gerçek kullanıcıya yanlış kredi düşmemeli)
        openPricingSafe();
        return;
      }

      // kredi kontrol
      if ((pick.value | 0) < COST) {
        toastSafe("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
        openPricingSafe();
        return;
      }

      // kredi düş
      var okWrite = writeCreditsToKey(pick.key, (pick.value | 0) - COST);
      console.log("[AIVO_APP] CREDIT WRITE", { key: pick.key, from: pick.value, to: (pick.value | 0) - COST, okWrite: okWrite });

      refreshCreditsUI();
      toastSafe("İşlem başlatıldı. " + COST + " kredi harcandı.", "ok");

      // job ekle
      var prompt = val("#musicPrompt") || val("textarea[name='prompt']") || val("#prompt") || "";
      var mode = val("#musicMode") || "instrumental";
      var quality = val("#musicQuality") || "standard";
      var durationSec = Math.max(5, Number(val("#musicDuration") || "30") || 30);

      var res = await window.AIVO_APP.generateMusic({
        buttonEl: btn,
        email: email || "",
        prompt: prompt,
        mode: mode,
        durationSec: durationSec,
        quality: quality
      });

      if (!res || res.ok !== true) {
        console.warn("[AIVO_APP] generateMusic failed", res);
        toastSafe("Job başlatılamadı: " + String((res && res.error) || "unknown"), "error");
      }
    },
    true
  );
})();
