// AIVO STUDIO – studio.js (FULL / CLEAN / SAFE)
// Navigation + Pages + Pricing(KVKK) + Checkout(Mock) + Global Player
// Tek DOMContentLoaded — tek kapanış — parse error yok

document.addEventListener("DOMContentLoaded", function () {
  /* =========================================================
     HELPERS
     ========================================================= */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function closest(el, sel) {
    while (el && el.nodeType === 1) {
      if (el.matches && el.matches(sel)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function getParam(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; }
    catch (e) { return ""; }
  }

  function safeText(el, val) {
    if (!el) return;
    el.textContent = (val == null ? "" : String(val));
  }

  function openMsg(message) {
    // Eğer projede özel mesaj modalın varsa burada bağlayabilirsin.
    // Şimdilik güvenli fallback:
    alert(String(message || ""));
  }

  /* =========================================================
     PAGE SYSTEM (switchPage)
     ========================================================= */
  function pageExists(key) {
    return !!qs('.page[data-page="' + key + '"]');
  }

  function deactivateAllPages() {
    qsa(".page.is-active").forEach(function (p) { p.classList.remove("is-active"); });
  }

  function activateRealPage(key) {
    if (!pageExists(key)) return;
    deactivateAllPages();
    var el = qs('.page[data-page="' + key + '"]');
    if (el) el.classList.add("is-active");
  }

  function setActiveNavByPageKey(key) {
    // Topnav / sidebar link active sınıfını güncelle
    qsa('[data-page-link].is-active').forEach(function (a) { a.classList.remove("is-active"); });
    qsa('[data-page-link="' + key + '"]').forEach(function (a) { a.classList.add("is-active"); });
  }

  // Projede varsa çağırır (yoksa hata vermez)
  function callIf(fnName, arg) {
    if (typeof window[fnName] === "function") window[fnName](arg);
  }

  function switchPage(target) {
    if (!target) return;

    // VIDEO: ayrı page değil -> MUSIC + ai-video subview yaklaşımı
    if (target === "video" || target === "ai-video") {
      if (pageExists("music")) activateRealPage("music");
      setActiveNavByPageKey("music");
      callIf("switchMusicView", "ai-video");
      return;
    }

    if (!pageExists(target)) {
      console.warn("[AIVO] switchPage: hedef sayfa yok:", target);
      return;
    }

    activateRealPage(target);
    setActiveNavByPageKey(target);

    // MUSIC'e dönünce varsayılan alt görünüm
    if (target === "music") {
      callIf("switchMusicView", "geleneksel");
      callIf("setRightPanelMode", "music");
      callIf("refreshEmptyStates");
    }
  }

  // Dışarıdan da çağrılabilsin
  window.switchPage = switchPage;

  /* =========================================================
     NAV HANDLERS (topnav + sidebar)
     ========================================================= */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("[data-page-link]") : closest(e.target, "[data-page-link]");
    if (!a) return;

    e.preventDefault();
    var key = a.getAttribute("data-page-link");
    switchPage(key);
  });

  /* =========================================================
     PRICING MODAL + KVKK LOCK + BUY -> CHECKOUT
     ========================================================= */
  var pricingModal = qs("#pricingModal");
  var creditsButton = qs("#creditsButton") || qs("[data-open-pricing]");
  var closePricingBtn = qs("#closePricing");
  var pricingBackdrop = pricingModal ? qs(".pricing-backdrop", pricingModal) : null;

  var kvkkCheckbox = pricingModal ? qs('[data-kvkk-check]', pricingModal) : null;

  function openPricing() {
    if (!pricingModal) return;
    pricingModal.classList.add("is-open");
    document.body.classList.add("modal-open");
    syncBuyButtonsLock();
  }

  function closePricing() {
    if (!pricingModal) return;
    pricingModal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
  }

  function syncBuyButtonsLock() {
    if (!pricingModal) return;
    var ok = kvkkCheckbox ? !!kvkkCheckbox.checked : true;

    qsa("[data-buy-plan][data-buy-price]", pricingModal).forEach(function (btn) {
      if (!ok) {
        btn.disabled = true;
        btn.classList.add("is-locked");
      } else {
        btn.disabled = false;
        btn.classList.remove("is-locked");
      }
    });
  }

  if (creditsButton) creditsButton.addEventListener("click", function (e) { e.preventDefault(); openPricing(); });
  if (closePricingBtn) closePricingBtn.addEventListener("click", function (e) { e.preventDefault(); closePricing(); });
  if (pricingBackdrop) pricingBackdrop.addEventListener("click", function () { closePricing(); });

  if (kvkkCheckbox) {
    kvkkCheckbox.addEventListener("change", function () {
      syncBuyButtonsLock();
    });
  }

  // BUY -> CHECKOUT redirect
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("[data-buy-plan][data-buy-price]") : closest(e.target, "[data-buy-plan][data-buy-price]");
    if (!btn) return;

    // modal içindeyse KVKK kontrol
    if (pricingModal && pricingModal.classList.contains("is-open") && kvkkCheckbox && !kvkkCheckbox.checked) {
      e.preventDefault();
      openMsg("Devam etmek için KVKK onayını işaretlemelisin.");
      return;
    }

    e.preventDefault();

    var plan = (btn.getAttribute("data-buy-plan") || "").trim();
    var price = (btn.getAttribute("data-buy-price") || "").trim();

    // fallback olarak sessionStorage’a da yaz
    try {
      sessionStorage.setItem("aivo_checkout_plan", plan);
      sessionStorage.setItem("aivo_checkout_price", price);
    } catch (err) {}

    var v = Date.now();
    window.location.href =
      "/checkout.html?v=" + v +
      "&plan=" + encodeURIComponent(plan) +
      "&price=" + encodeURIComponent(price);
  });

  /* =========================================================
     CHECKOUT PAGE INIT (render + mock pay)
     ========================================================= */
  (function initCheckoutIfExists() {
    var payBtn = qs("[data-checkout-pay]");
    var planEl = qs("#checkoutPlan");
    var priceEl = qs("#checkoutPrice");

    // checkout sayfası değilse çık
    if (!payBtn && !planEl && !priceEl) return;

    function readPlanPrice() {
      var plan = getParam("plan");
      var price = getParam("price");

      // URL boşsa sessionStorage fallback
      if (!plan || !price) {
        try {
          plan = plan || (sessionStorage.getItem("aivo_checkout_plan") || "");
          price = price || (sessionStorage.getItem("aivo_checkout_price") || "");
        } catch (e) {}
      }
      return { plan: (plan || "").trim(), price: (price || "").trim() };
    }

    function renderCheckout() {
      var pp = readPlanPrice();
      if (planEl) safeText(planEl, pp.plan || "—");
      if (priceEl) safeText(priceEl, pp.price || "—");
      return pp;
    }

    function setPayState(btn, loading) {
      if (!btn) return;
      if (loading) {
        btn.dataset.prevText = btn.textContent || "Ödemeye Geç";
        btn.textContent = "İşleniyor…";
        btn.disabled = true;
        btn.classList.add("is-loading");
      } else {
        btn.textContent = btn.dataset.prevText || "Ödemeye Geç";
        btn.disabled = false;
        btn.classList.remove("is-loading");
      }
    }

    function addDemoCredits(amount) {
      var key = "aivo_credits";
      var cur = 0;
      try { cur = parseInt(localStorage.getItem(key) || "0", 10) || 0; } catch (e) {}
      localStorage.setItem(key, String(cur + (amount || 0)));
    }

    function saveDemoInvoice(invoice) {
      var key = "aivo_invoices";
      var list = [];
      try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}
      list.unshift(invoice);
      localStorage.setItem(key, JSON.stringify(list));
    }

    // render on load
    renderCheckout();

    if (!payBtn) return;

    // double bind koruması
    if (payBtn.dataset.boundPay === "1") return;
    payBtn.dataset.boundPay = "1";

    payBtn.addEventListener("click", function () {
      if (payBtn.dataset.locked === "1") return;
      payBtn.dataset.locked = "1";

      var pp = renderCheckout();
      var plan = pp.plan;
      var price = pp.price;

      if (!plan || !price) {
        openMsg("Plan / fiyat okunamadı. Pricing ekranından tekrar deneyin.");
        payBtn.dataset.locked = "0";
        return;
      }

      setPayState(payBtn, true);

      fetch("/api/mock-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan, price: price })
      })
        .then(function (r) {
          return r.json().catch(function () { return null; })
            .then(function (data) { return { ok: r.ok, data: data }; });
        })
        .then(function (res) {
          var data = res.data;

          if (!res.ok || !data || data.ok !== true) {
            openMsg((data && data.message) || "Mock ödeme başarısız. Tekrar deneyin.");
            payBtn.dataset.locked = "0";
            setPayState(payBtn, false);
            return;
          }

          // demo kredi
          addDemoCredits(data.creditsAdded || 0);

          // demo fatura
          saveDemoInvoice({
            invoiceId: data.invoiceId,
            paymentId: data.paymentId,
            plan: data.plan,
            price: data.price,
            creditsAdded: data.creditsAdded,
            createdAt: new Date().toISOString()
          });

          // yönlendirme
          window.location.href = "/?page=invoices&v=" + Date.now();
        })
        .catch(function () {
          openMsg("Ağ hatası (demo).");
          payBtn.dataset.locked = "0";
          setPayState(payBtn, false);
        });
    });
  })();

  /* =========================================================
     GLOBAL PLAYER – SAFE STUBS (if missing)
     ========================================================= */
  // Eğer projende zaten gpShow/gpHide/shouldPlayerBeAllowed tanımlıysa burası dokunmaz.
  if (typeof window.shouldPlayerBeAllowed !== "function") {
    window.shouldPlayerBeAllowed = function () { return true; };
  }

  if (typeof window.gpShow !== "function") {
    window.gpShow = function () {
      var gp = qs("#globalPlayer");
      if (gp) gp.classList.add("is-open");
    };
  }

  if (typeof window.gpHide !== "function") {
    window.gpHide = function () {
      var gp = qs("#globalPlayer");
      if (gp) gp.classList.remove("is-open");
    };
  }

  /* =========================================================
     GLOBAL PLAYER – INITIAL VISIBILITY (SAFE)  ✅ senin istediğin
     ========================================================= */
  if (
    typeof shouldPlayerBeAllowed === "function" &&
    typeof gpShow === "function" &&
    typeof gpHide === "function"
  ) {
    if (shouldPlayerBeAllowed()) gpShow();
    else gpHide();
  }

}); // ✅ SADECE 1 TANE KAPANIŞ — DOMContentLoaded
