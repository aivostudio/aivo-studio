// Navigation + Music subviews + Pricing modal + Media modal + Right panel

// ===============================
// AIVO STUDIO – FINAL JS (A–Z)
// - Tek DOMContentLoaded
// - switchPage GLOBAL (window.switchPage)
// - Player seek içine GÖMÜLÜ yanlış switchPage temizlendi
// - Pricing "Satın Al" -> Checkout yönlendirme fix
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     HELPERS
     ========================================================= */
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function pageExists(key) {
    return !!qs(`.page[data-page="${key}"]`);
  }

  function getActivePageKey() {
    return qs(".page.is-active")?.getAttribute("data-page") || null;
  }

  function setTopnavActive(target) {
    qsa('.topnav-link[data-page-link]').forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('data-page-link') === target);
    });
  }

  function setSidebarsActive(target) {
    qsa('.sidebar [data-page-link]').forEach((b) => b.classList.remove('is-active'));
    const activePage = qs('.page.is-active');
    if (!activePage) return;
    qsa('.sidebar [data-page-link]', activePage).forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-page-link') === target);
    });
  }

  function activateRealPage(target) {
    qsa('.page').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-page') === target);
    });
    setTopnavActive(target);
    setSidebarsActive(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* =========================================================
     PAGE SWITCH (TEK KAYNAK)
     ========================================================= */
  function switchPage(target) {
    if (!target) return;

    // Video subview özel akış (gerçek page: music)
    if (target === 'video' || target === 'ai-video') {
      if (pageExists('music')) activateRealPage('music');
      if (typeof switchMusicView === 'function') switchMusicView('ai-video');
      setTopnavActive('video');
      setSidebarsActive('music');
      if (typeof setRightPanelMode === 'function') setRightPanelMode('video');
      if (typeof refreshEmptyStates === 'function') refreshEmptyStates();
      return;
    }

    if (!pageExists(target)) {
      console.warn('[AIVO] switchPage: hedef sayfa yok:', target);
      return;
    }

    activateRealPage(target);

    if (target === 'music') {
      if (typeof switchMusicView === 'function') switchMusicView('geleneksel');
      if (typeof setRightPanelMode === 'function') setRightPanelMode('music');
      if (typeof refreshEmptyStates === 'function') refreshEmptyStates();
    }
  }

  // 🔑 GLOBAL expose (Pricing modal bunu çağırıyor)
  window.switchPage = switchPage;

  /* =========================================================
     GLOBAL CLICK HANDLER (NAV + MODALS)
     ========================================================= */
  document.addEventListener('click', (e) => {
    // Pricing modal aç
    const pricingEl = e.target.closest('[data-open-pricing]');
    if (pricingEl) {
      e.preventDefault();
      if (typeof openPricing === 'function') openPricing();
      return;
    }

    // Page navigation
    const linkEl = e.target.closest('[data-page-link]');
    if (!linkEl) return;

    const target = linkEl.getAttribute('data-page-link');
    if (!target) return;

    const pricingKeys = new Set(['pricing', 'credits', 'kredi', 'kredi-al', 'credit', 'buy-credits']);
    if (pricingKeys.has(target)) {
      e.preventDefault();
      if (typeof openPricing === 'function') openPricing();
      return;
    }

    e.preventDefault();
    switchPage(target);
  });

  /* =========================================================
     PRICING MODAL + KVKK + BUY -> CHECKOUT
     (Delegated, anchor/button fark etmez)
     ========================================================= */
  (function () {
    const pricingModal = qs('#pricingModal');
    if (!pricingModal) return;

    const pricingBackdrop = qs('.pricing-backdrop', pricingModal);
    const closePricingBtn = qs('[data-close-pricing]', pricingModal);
    const kvkkCheckbox = qs('[data-kvkk-check]', pricingModal);

    function isKvkkOk() {
      return !!(kvkkCheckbox && kvkkCheckbox.checked);
    }

    function setCheckoutData(plan, price) {
      try {
        localStorage.setItem('aivo_checkout_plan', plan || '');
        localStorage.setItem('aivo_checkout_price', price || '');
      } catch (e) {}
      const p = qs('#checkoutPlan');
      const pr = qs('#checkoutPrice');
      if (p) p.textContent = plan || '—';
      if (pr) pr.textContent = price || '—';
    }

    function renderCheckout() {
      const p = localStorage.getItem('aivo_checkout_plan');
      const pr = localStorage.getItem('aivo_checkout_price');
      const elP = qs('#checkoutPlan');
      const elPr = qs('#checkoutPrice');
      if (elP) elP.textContent = p || '—';
      if (elPr) elPr.textContent = pr || '—';
    }

    function closePricing() {
      pricingModal.classList.remove('is-open');
      document.body.classList.remove('modal-open');
    }

    pricingModal.addEventListener('click', function (e) {
      let t = e.target;
      let buyBtn = null;
      if (t && t.closest) buyBtn = t.closest('[data-buy-plan][data-buy-price]');
      else {
        while (t && t !== pricingModal) {
          if (t.matches && t.matches('[data-buy-plan][data-buy-price]')) { buyBtn = t; break; }
          t = t.parentElement;
        }
      }
      if (!buyBtn) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      if (!isKvkkOk()) return;

      const plan = buyBtn.getAttribute('data-buy-plan') || '';
      const price = buyBtn.getAttribute('data-buy-price') || '';

      setCheckoutData(plan, price);
      renderCheckout();
      switchPage('checkout');
      closePricing();
    });

    if (closePricingBtn) closePricingBtn.addEventListener('click', (e) => { e.preventDefault(); closePricing(); });
    if (pricingBackdrop) pricingBackdrop.addEventListener('click', (e) => { e.preventDefault(); closePricing(); });
  })();

  /* =========================================================
     GLOBAL PLAYER (DÜZELTİLMİŞ)
     ========================================================= */
  function bindGlobalPlayerToLists() {
    if (!window.gp) return;
    const gp = window.gp;

    if (gp.seek && gp.audio) {
      gp.seek.addEventListener('input', () => {
        if (!isFinite(gp.audio.duration) || gp.audio.duration <= 0) return;
        const pct = Number(gp.seek.value || 0);
        gp.audio.currentTime = (pct / 100) * gp.audio.duration;
      });
    }
  }

  bindGlobalPlayerToLists();

  /* ✅ İlk açılışta player görünürlüğü */
  if (typeof shouldPlayerBeAllowed === 'function') {
    if (shouldPlayerBeAllowed()) gpShow();
    else gpHide();
  }

  // İlk açılış
  switchPage('studio');
});

