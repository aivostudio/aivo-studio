/* =========================================================
   AIVO — INDEX/KURUMSAL AUTO-OPEN LOGIN (VERIFY TRAFFIC)
   URL: /?open=login&verified=1&email=...&from=...
   - login modal/paneli otomatik açar
   - email input'unu doldurur
   - verified toast gösterir (alert değil)
   - from paramını login sonrası redirect için saklar
   - URL paramlarını temizler (history.replaceState)
   ========================================================= */
(() => {
  if (window.__AIVO_VERIFY_TRAFFIC__) return;
  window.__AIVO_VERIFY_TRAFFIC__ = true;

  const p = new URLSearchParams(location.search);
  const open = p.get("open");
  if (open !== "login") return;

  const verified = p.get("verified") === "1";
  const email = (p.get("email") || "").trim();
  const from = (p.get("from") || "").trim();

  // 1) from'u sakla (login core zaten sessionStorage'dan okuyabilir)
  if (from) {
    try { sessionStorage.setItem("aivo_after_login", from); } catch (_) {}
  }

  // 2) Login panelini aç (mevcut sistemine toleranslı)
  // Öncelik: senin core fonksiyonların -> fallback: #btnLoginTop click
  function openLoginPanel() {
    try {
      // senin auth core'un varsa:
      if (window.AIVO_AUTH?.openLogin) return window.AIVO_AUTH.openLogin();
      if (typeof window.openAuthModal === "function") return window.openAuthModal("login");
      if (typeof window.openLoginModal === "function") return window.openLoginModal();
      if (typeof window.openModal === "function") return window.openModal("login");

      // fallback: topbar login butonuna tıkla
      const btn = document.querySelector("#btnLoginTop, [data-open='login'], [data-action='open-login']");
      if (btn) btn.click();
    } catch (_) {}
  }

  // 3) Email input'unu doldur
  function fillEmail() {
    if (!email) return;
    const el = document.querySelector(
      'input[name="email"], #loginEmail, [data-auth-email], input[type="email"]'
    );
    if (el) el.value = email;
  }

  // 4) Toast (alert değil)
  // Projede AIVO_TOAST varsa onu kullan, yoksa küçük bir toast fallback bas.
  function toastSuccess(msg) {
    try {
      if (window.AIVO_TOAST?.success) return window.AIVO_TOAST.success(msg);
      if (window.toast?.success) return window.toast.success(msg);
    } catch (_) {}

    // fallback mini toast
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = `
      position:fixed;left:50%;bottom:28px;transform:translateX(-50%);
      z-index:999999;background:rgba(20,20,25,.92);color:#fff;
      padding:12px 14px;border-radius:12px;font:600 14px/1.2 system-ui;
      box-shadow:0 10px 30px rgba(0,0,0,.35);
      max-width:min(92vw,520px);text-align:center;
      opacity:0;transition:opacity .18s ease, transform .18s ease;
    `;
    document.body.appendChild(t);
    requestAnimationFrame(() => {
      t.style.opacity = "1";
      t.style.transform = "translateX(-50%) translateY(-2px)";
    });
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateX(-50%) translateY(6px)";
      setTimeout(() => t.remove(), 220);
    }, 2600);
  }

  // 5) URL'yi temizle (parametreleri kaldır)
  function cleanUrl() {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("open");
      url.searchParams.delete("verified");
      url.searchParams.delete("email");
      url.searchParams.delete("from");
      history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + url.hash);
    } catch (_) {}
  }

  // UI hazır olunca çalıştır
  // (modal DOM'u biraz gecikmeli gelebilir)
  let tries = 0;
  (function tick() {
    tries++;
    openLoginPanel();

    // modal açıldıktan sonra input bulunabilir
    fillEmail();

    if (verified) {
      toastSuccess("Email doğrulandı. Şimdi giriş yapabilirsin.");
    }

    cleanUrl();

    // 1-2 tur daha dene (gecikmeli render için)
    if (tries < 3) setTimeout(tick, 220);
  })();
})();
