<!-- ✅ PRICING HUB CONTROLLER (FINAL — STRIPE + USER_EMAIL) -->
<script>
/* =========================================================
   AIVO — PRICING HUB CONTROLLER (FINAL)
   - #packs içindeki .p-btn[data-pack] butonları
   - Guest: login modal + remember pack
   - Authed: Stripe checkout (POST /api/stripe/create-checkout-session)
   - user_email zorunlu: localStorage / window üzerinden alır
   - Topbar "Kredi Al": sadece #packs scroll
   ========================================================= */
(function AIVO_PricingHub_FINAL(){
  if (window.__AIVO_PRICING_HUB_FINAL__) return;
  window.__AIVO_PRICING_HUB_FINAL__ = true;

  var modal = document.getElementById("loginModal");

  function isAuthed(){
    try {
      if (typeof window.isLoggedIn === "function") return !!window.isLoggedIn();
      if (typeof window.isLoggedIn === "boolean") return !!window.isLoggedIn;
    } catch(e){}
    if (localStorage.getItem("aivo_logged_in") === "1") return true;
    if (localStorage.getItem("aivo_user_email")) return true;
    return false;
  }

  function getUserEmail(){
    var email =
      (window.currentUserEmail && String(window.currentUserEmail)) ||
      (localStorage.getItem("aivo_user_email") || "") ||
      "";
    return String(email).trim();
  }

  function openModal(mode){
    if (!modal) { location.href = "/login.html"; return; }
    modal.dataset.mode = (mode === "register") ? "register" : "login";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal(){
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  // modal backdrop close + exports
  if (modal) {
    if (!window.openAuthModal) window.openAuthModal = function(m){ openModal(m); };
    if (!window.openLoginModal) window.openLoginModal = function(){ openModal("login"); };
    if (!window.openRegisterModal) window.openRegisterModal = function(){ openModal("register"); };

    modal.addEventListener("click", function(e){
      var t = e.target;
      if (!t) return;
      if (t.hasAttribute("data-close-login") || t.classList.contains("login-backdrop")) closeModal();
    });
  }

  function scrollToPacks(){
    var el = document.getElementById("packs");
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior:"smooth", block:"start" });
    else location.hash = "#packs";
  }

  async function startStripeCheckout(pack){
    if (!pack) { scrollToPacks(); return; }

    var email = getUserEmail();
    if (!email) {
      alert("Oturum email bilgisi alınamadı. Lütfen çıkış yapıp tekrar giriş yap.");
      return;
    }

    try {
      var res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack: String(pack),
          user_email: email
        })
      });

      if (!res.ok) {
        var txt = await res.text().catch(function(){ return ""; });
        console.error("[AIVO] checkout-session failed:", res.status, txt);
        alert("Ödeme başlatılamadı. (checkout-session error)");
        return;
      }

      var data = await res.json().catch(function(){ return null; });
      if (data && data.url) {
        location.href = data.url;
        return;
      }

      console.error("[AIVO] checkout-session missing url:", data);
      alert("Ödeme başlatılamadı. (missing url)");
    } catch (err) {
      console.error("[AIVO] checkout-session exception:", err);
      alert("Ödeme başlatılamadı. (network/exception)");
    }
  }

  // ✅ tek yakalayıcı
  document.addEventListener("click", function(e){
    var t = e.target;
    if (!t || !t.closest) return;

    var topBuy = t.closest(".btn-credit-buy, [data-open-pricing]");
    var packBtn = t.closest("#packs .p-btn[data-pack]");

    if (!topBuy && !packBtn) return;

    // Topbar: sadece scroll
    if (topBuy && !packBtn) {
      e.preventDefault();
      scrollToPacks();
      return;
    }

    // Pack button
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    var pack = packBtn.getAttribute("data-pack") || "";

    if (!isAuthed()) {
      sessionStorage.setItem("aivo_after_login", "/fiyatlandirma.html#packs");
      sessionStorage.setItem("aivo_selected_pack", String(pack));
      openModal("login");
      return;
    }

    startStripeCheckout(pack);
  }, true);

})();
</script>
