/* =========================================================
   studio.profile.js — FINAL (TOPBAR-BAĞIMSIZ)
   - Sadece .page-profile içinden okur
   - data-profile-* attribute’larını kullanır
   - Profil binder + Password modal (SAFE)
   - studio.js frozen varsayımıyla çakışmaz
   ========================================================= */
(function () {
  "use strict";

  /* ===============================
     HELPERS
     =============================== */
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function text(el, val) {
    if (el) el.textContent = val;
  }

  function value(el, val) {
    if (el) el.value = val;
  }

  function safeGetLS(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSetLS(key, val) {
    try {
      localStorage.setItem(key, val);
      return true;
    } catch (e) {
      return false;
    }
  }

  function toast(type, msg) {
    try {
      if (window.AIVO_TOAST && typeof window.AIVO_TOAST === "function") {
        window.AIVO_TOAST(type, msg);
        return;
      }
    } catch (e) {}

    // Fallback (güvenli)
    if (type === "error") alert(msg);
    else console.log("[AIVO]", msg);
  }

  function getProfilePage() {
    return qs('.page-profile[data-page="profile"]');
  }

  /* ===============================
     PROFİL VERİ KAYNAĞI (tek gerçek)
     =============================== */
  function readProfileData() {
    var page = getProfilePage();
    if (!page) return null;

    var cachedName = (safeGetLS("aivo_profile_name") || "").trim();

    var name =
      (qs("[data-profile-input-name]", page)?.value || "").trim() ||
      (qs("[data-profile-name]", page)?.textContent || "").trim() ||
      cachedName;

    var email =
      (qs("[data-profile-input-email]", page)?.value || "").trim() ||
      (qs("[data-profile-email]", page)?.textContent || "").trim();

    // Not: data-profile-plan / credit hem ribbon'da hem sağ panelde var (qsa ile toplu basıyoruz)
    var planText = (qs("[data-profile-plan]", page)?.textContent || "").trim();
    var creditText = (qs("[data-profile-credit]", page)?.textContent || "").trim();

    // Normalize
    var plan = "Basic";
    var credit = "0";

    if (planText) {
      var pm = planText.match(/Plan:\s*(.+)$/i);
      if (pm && pm[1]) plan = pm[1].trim();
    }

    if (creditText) {
      var cm = creditText.match(/(\d+)/);
      if (cm && cm[1]) credit = cm[1];
    }

    return {
      name: name || "Kullanıcı",
      email: email || "—",
      plan: plan,
      credit: credit
    };
  }

  /* ===============================
     UI APPLY
     =============================== */
  function applyProfile() {
    var page = getProfilePage();
    if (!page) return;

    var data = readProfileData();
    if (!data) return;

    // Avatar initial
    var initial = (data.name || "K").charAt(0).toUpperCase();
    text(qs("[data-profile-initial]", page), initial);

    // Name / Email
    text(qs("[data-profile-name]", page), data.name);
    text(qs("[data-profile-email]", page), data.email);

    // Chips / Labels (çoklu)
    var planEls = qsa("[data-profile-plan]", page);
    for (var i = 0; i < planEls.length; i++) {
      planEls[i].textContent = "Plan: " + data.plan;
    }

    var creditEls = qsa("[data-profile-credit]", page);
    for (var j = 0; j < creditEls.length; j++) {
      creditEls[j].textContent = "Kredi: " + data.credit;
    }

    // Form alanları
    value(qs("[data-profile-input-name]", page), data.name);
    value(qs("[data-profile-input-email]", page), data.email);
  }

  /* ===============================
     SAVE (LOCAL)
     =============================== */
  function bindSave() {
    var page = getProfilePage();
    if (!page) return;

    var btn = qs("[data-profile-save]", page);
    if (!btn) return;

    // Çift bind koruması
    if (btn.__aivoBound) return;
    btn.__aivoBound = true;

    btn.addEventListener("click", function () {
      var name = (qs("[data-profile-input-name]", page)?.value || "").trim();
      if (!name) {
        toast("error", "Ad alanı boş olamaz.");
        return;
      }

      safeSetLS("aivo_profile_name", name);

      text(qs("[data-profile-name]", page), name);
      text(qs("[data-profile-initial]", page), name.charAt(0).toUpperCase());

      toast("ok", "Profil güncellendi.");
    });
  }

  /* ===============================
     PAGE SWITCH SUPPORT
     =============================== */
  function observePage() {
    if (window.__aivoProfileObserverBound) return;
    window.__aivoProfileObserverBound = true;

    var mo = new MutationObserver(function () {
      var active = document.body.getAttribute("data-active-page");
      if (active === "profile") {
        applyProfile();
        bindSave();
      }
    });

    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-active-page"]
    });
  }

  /* =========================================================
     PASSWORD MODAL (PROFILE) — FINAL / SAFE
     HTML uyumu:
     - [data-password-modal]
     - [data-open-password]
     - [data-password-close]
     - [data-pw-current]
     - [data-pw-new]
     - [data-pw-new2]
     - [data-pw-submit]
     ========================================================= */
  function bindPasswordModal() {
    if (window.__aivoPasswordModalBound) return;
    window.__aivoPasswordModalBound = true;

    function getModal() {
      return qs("[data-password-modal]");
    }

    function isOpen(modal) {
      // Açıkken aria-hidden="false" kabul ediyoruz
      return modal && modal.getAttribute("aria-hidden") === "false";
    }

    function openModal() {
      var modal = getModal();
      if (!modal) return;

      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("is-open");
      document.body.classList.add("modal-open");

      // Panel/ilk input focus
      setTimeout(function () {
        var panel = qs(".aivo-modal__panel", modal);
        if (panel) panel.focus();
        var first = qs("[data-pw-current]", modal);
        if (first) first.focus();
      }, 0);
    }

    function closeModal() {
      var modal = getModal();
      if (!modal) return;

      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
      document.body.classList.remove("modal-open");

      // inputları temizle (Safari safe)
      var inputs = qsa("input", modal);
      for (var i = 0; i < inputs.length; i++) inputs[i].value = "";
    }

    // OPEN / CLOSE / SUBMIT delegated
    document.addEventListener(
      "click",
      function (e) {
        var t = e.target;

        // OPEN
        var openBtn = t.closest && t.closest("[data-open-password]");
        if (openBtn) {
          e.preventDefault();
          openModal();
          return;
        }

        // CLOSE
        var closeBtn = t.closest && t.closest("[data-password-close]");
        if (closeBtn) {
          e.preventDefault();
          closeModal();
          return;
        }

        // SUBMIT
        var submit = t.closest && t.closest("[data-pw-submit]");
        if (submit) {
          e.preventDefault();

          var modal = getModal();
          if (!modal) return;

          var cur = qs("[data-pw-current]", modal);
          var n1 = qs("[data-pw-new]", modal);
          var n2 = qs("[data-pw-new2]", modal);

          var curV = (cur?.value || "").trim();
          var n1V = (n1?.value || "").trim();
          var n2V = (n2?.value || "").trim();

          if (!curV || !n1V || !n2V) {
            toast("error", "Lütfen tüm alanları doldurun.");
            return;
          }
          if (n1V.length < 8) {
            toast("error", "Yeni şifre en az 8 karakter olmalı.");
            return;
          }
          if (n1V !== n2V) {
            toast("error", "Yeni şifreler eşleşmiyor.");
            return;
          }

          // TODO: backend entegrasyonu buraya (api/auth/password-change)
          console.log("PASSWORD CHANGE OK (frontend):", { current: curV, next: n1V });

          toast("ok", "Şifre başarıyla güncellendi.");
          closeModal();
          return;
        }
      },
      true
    );

    // ESC ile kapat
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var modal = getModal();
      if (!modal) return;
      if (isOpen(modal)) closeModal();
    });
  }

  /* ===============================
     INIT
     =============================== */
  document.addEventListener("DOMContentLoaded", function () {
    // İlk yük
    applyProfile();
    bindSave();

    // SPA-like page switch
    observePage();

    // Modal binder
    bindPasswordModal();

    // Debug (istersen sonra kaldırırsın)
    // console.log("[studio.profile.js] loaded");
  });
})();
