// /admin/admin.js
(function () {
  const $ = (id) => document.getElementById(id);

  // 1) Sayfa ilk açılışta KİLİTLİ başlasın
  document.body.classList.add("is-locked");

  function showLocked(msg) {
    const lock = $("lockScreen");
    const lockMsg = $("lockMsg");
    if (lock) lock.style.display = "block";
    if (lockMsg) lockMsg.textContent = msg || "Admin yetkin yok veya giriş bulunamadı.";
  }

  function showUnlocked() {
    document.body.classList.remove("is-locked");
    const lock = $("lockScreen");
    if (lock) lock.style.display = "none";
  }

  // 2) LocalStorage’dan email bul
  function getEmailFromStorage() {
    const keys = ["aivo_user_email", "user_email", "email", "aivo_email", "auth_email"];
    for (let i = 0; i < keys.length; i++) {
      const v = String(localStorage.getItem(keys[i]) || "").trim().toLowerCase();
      if (v && v.includes("@")) return v;
    }
    return "";
  }

  function isEmailLike(v) {
    const s = String(v || "").trim().toLowerCase();
    return s.includes("@") && s.includes(".");
  }

  // 3) Admin AUTH kontrolü
  async function adminAuth() {
    const email = getEmailFromStorage();

    if (!email) {
      showLocked("Giriş bulunamadı. Önce Studio’da admin e-posta ile giriş yap.");
      return { ok: false, reason: "no_email" };
    }

    try {
      const res = await fetch("/api/admin/auth?email=" + encodeURIComponent(email), { cache: "no-store" });
      const json = await res.json();

      if (json && json.ok) {
        showUnlocked();
        return { ok: true, email };
      }

      showLocked("Bu hesap admin allowlist’inde değil (ADMIN_EMAILS).");
      return { ok: false, reason: "not_allowed", email };
    } catch (err) {
      showLocked("Admin auth kontrolü başarısız. /api/admin/auth erişimini kontrol et.");
      return { ok: false, reason: "fetch_error", email };
    }
  }

  // 4) SAYFA AÇILIŞ GATE
  adminAuth().then((state) => {
    if (!state.ok) return;

    // 5) Admin UI AKTİF
    const whoEl = $("who");
    if (whoEl && state.email) whoEl.textContent = "Giriş: " + state.email;

    // ---- Yetki tekrar kontrol ----
    const btnCheck = $("btnCheck");
    if (btnCheck) {
      btnCheck.addEventListener("click", async () => {
        const s = await adminAuth();
        const out = $("authState");
        if (out) out.textContent = s.ok ? "✅ Admin yetkisi OK" : "⛔ Admin yetkisi YOK";
      });
    }

    // ---- Kredi getir ----
    const btnGetCredits = $("btnGetCredits");
    if (btnGetCredits) {
      btnGetCredits.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const email = String($("qEmail")?.value || "").trim().toLowerCase();
        const out = $("creditsOut");

        if (!isEmailLike(email)) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "email_invalid" }, null, 2);
          return;
        }

        try {
          // ✅ admin param eklendi (backend allowlist için)
          const r = await fetch(
            "/api/admin/credits/get?admin=" + encodeURIComponent(s.email) + "&email=" + encodeURIComponent(email),
            { cache: "no-store" }
          );
          const j = await r.json();
          if (out) out.textContent = JSON.stringify(j, null, 2);
        } catch (e) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "fetch_failed" }, null, 2);
        }
      });
    }

    // ---- Kredi ayarla (delta) ----
    const btnAdjust = $("btnAdjust");
    if (btnAdjust) {
      btnAdjust.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const email = String($("aEmail")?.value || "").trim().toLowerCase();
        const delta = Number(String($("aDelta")?.value || "").trim());
        const reason = String($("aReason")?.value || "").trim() || "manual_adjust";
        const out = $("adjustOut");

        if (!isEmailLike(email)) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "email_invalid" }, null, 2);
          return;
        }
        if (!Number.isFinite(delta) || delta === 0) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "delta_invalid" }, null, 2);
          return;
        }

        try {
          const r = await fetch("/api/admin/credits/set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // ✅ admin eklendi (backend allowlist için)
            body: JSON.stringify({ admin: s.email, email, delta, reason }),
          });

          const j = await r.json();
          if (out) out.textContent = JSON.stringify(j, null, 2);
        } catch (e) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "fetch_failed" }, null, 2);
        }
      });
    }

    // ---- Satın alımlar ----
    const btnPurchases = $("btnPurchases");
    if (btnPurchases) {
      btnPurchases.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const out = $("pOut");
        try {
          const r = await fetch("/api/admin/purchases", { cache: "no-store" });
          const j = await r.json();
          if (out) out.textContent = JSON.stringify(j, null, 2);
        } catch (e) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "fetch_failed" }, null, 2);
        }
      });
    }
  });
})();
