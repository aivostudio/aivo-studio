/* =========================================================
   PROFILE BINDER (FINAL / TOPBAR-BAĞIMSIZ)
   - Sadece .page-profile içinden okur
   - data-profile-* attribute’larını kullanır
   - Tek kaynak, tek gerçek
   ========================================================= */
(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(sel)
    );
  }

  function text(el, val) {
    if (el) el.textContent = val;
  }

  function value(el, val) {
    if (el) el.value = val;
  }

  /* ===============================
     PROFİL VERİ KAYNAĞI
     (tek gerçek)
     =============================== */
  function readProfileData() {
    var page = qs('.page-profile[data-page="profile"]');
    if (!page) return null;

    var name =
      (qs('[data-profile-input-name]', page)?.value || "").trim() ||
      (qs('[data-profile-name]', page)?.textContent || "").trim();

    var email =
      (qs('[data-profile-input-email]', page)?.value || "").trim() ||
      (qs('[data-profile-email]', page)?.textContent || "").trim();

    var planText =
      (qs('[data-profile-plan]', page)?.textContent || "").trim();

    var creditText =
      (qs('[data-profile-credit]', page)?.textContent || "").trim();

    // Normalize
    var plan = "Basic";
    var credit = "0";

    if (planText) {
      var pm = planText.match(/Plan:\s*(.+)$/i);
      if (pm) plan = pm[1].trim();
    }

    if (creditText) {
      var cm = creditText.match(/(\d+)/);
      if (cm) credit = cm[1];
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
    var page = qs('.page-profile[data-page="profile"]');
    if (!page) return;

    var data = readProfileData();
    if (!data) return;

    // Avatar initial
    text(
      qs('[data-profile-initial]', page),
      data.name.charAt(0).toUpperCase()
    );

    // Name / Email
    text(qs('[data-profile-name]', page), data.name);
    text(qs('[data-profile-email]', page), data.email);

    // Chips (üst ribbon)
    qsa('[data-profile-plan]', page).forEach(function (el) {
      if (el.textContent.indexOf("Plan:") === -1) {
        el.textContent = "Plan: " + data.plan;
      } else {
        el.textContent = "Plan: " + data.plan;
      }
    });

    qsa('[data-profile-credit]', page).forEach(function (el) {
      if (el.textContent.indexOf("Kredi") === -1) {
        el.textContent = "Kredi: " + data.credit;
      } else {
        el.textContent = "Kredi: " + data.credit;
      }
    });

    // Form alanları
    value(qs('[data-profile-input-name]', page), data.name);
    value(qs('[data-profile-input-email]', page), data.email);
  }

  /* ===============================
     SAVE (LOCAL)
     =============================== */
  function bindSave() {
    var page = qs('.page-profile[data-page="profile"]');
    if (!page) return;

    var btn = qs('[data-profile-save]', page);
    if (!btn) return;

    btn.addEventListener("click", function () {
      var name = (qs('[data-profile-input-name]', page)?.value || "").trim();
      if (!name) return;

      try {
        localStorage.setItem("aivo_profile_name", name);
      } catch (e) {}

      // Güncelle
      text(qs('[data-profile-name]', page), name);
      text(qs('[data-profile-initial]', page), name.charAt(0).toUpperCase());
    });
  }

  /* ===============================
     PAGE SWITCH SUPPORT
     =============================== */
  function observePage() {
    var mo = new MutationObserver(function () {
      var active = document.body.getAttribute("data-active-page");
      if (active === "profile") {
        applyProfile();
      }
    });

    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-active-page"]
    });
  }

  /* ===============================
     INIT
     =============================== */
  document.addEventListener("DOMContentLoaded", function () {
    applyProfile();
    bindSave();
    observePage();
  });
})();
/* =========================================================
   PROFILE BINDER + PASSWORD MODAL (FINAL)
   - Topbar bağımsız
   - Sadece profile sayfası içinden okur
   - Şifre modal: open/close + validation + toast fallback
   ========================================================= */
(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function text(el, val) { if (el) el.textContent = val; }
  function value(el, val) { if (el) el.value = val; }

  function toast(type, msg) {
    // Eğer ileride kendi toast sistemin varsa buraya bağlarsın
    // Şimdilik güvenli fallback:
    try {
      if (window.AIVO_TOAST && typeof window.AIVO_TOAST === "function") {
        window.AIVO_TOAST(type, msg);
        return;
      }
    } catch (e) {}
    // fallback
    if (type === "error") alert(msg);
    else console.log("[AIVO]", msg);
  }

  /* ===============================
     PROFİL VERİ KAYNAĞI
     =============================== */
  function readProfileData() {
    var page = qs('.page-profile[data-page="profile"]');
    if (!page) return null;

    var name =
      (qs('[data-profile-input-name]', page)?.value || "").trim() ||
      (qs('[data-profile-name]', page)?.textContent || "").trim() ||
      (localStorage.getItem("aivo_profile_name") || "").trim();

    var email =
      (qs('[data-profile-input-email]', page)?.value || "").trim() ||
      (qs('[data-profile-email]', page)?.textContent || "").trim();

    var planText = (qs('[data-profile-plan]', page)?.textContent || "").trim();
    var creditText = (qs('[data-profile-credit]', page)?.textContent || "").trim();

    var plan = "Basic";
    var credit = "0";

    if (planText) {
      var pm = planText.match(/Plan:\s*(.+)$/i);
      if (pm) plan = pm[1].trim();
    }

    if (creditText) {
      var cm = creditText.match(/(\d+)/);
      if (cm) credit = cm[1];
    }

    return {
      name: name || "Kullanıcı",
      email: email || "—",
      plan: plan,
      credit: credit
    };
  }

  function applyProfile() {
    var page = qs('.page-profile[data-page="profile"]');
    if (!page) return;

    var data = readProfileData();
    if (!data) return;

    text(qs('[data-profile-initial]', page), data.name.charAt(0).toUpperCase());
    text(qs('[data-profile-name]', page), data.name);
    text(qs('[data-profile-email]', page), data.email);

    qsa('[data-profile-plan]', page).forEach(function (el) {
      el.textContent = "Plan: " + data.plan;
    });

    qsa('[data-profile-credit]', page).forEach(function (el) {
      el.textContent = "Kredi: " + data.credit;
    });

    value(qs('[data-profile-input-name]', page), data.name);
    value(qs('[data-profile-input-email]', page), data.email);
  }

  function bindSave() {
    var page = qs('.page-profile[data-page="profile"]');
    if (!page) return;

    var btn = qs('[data-profile-save]', page);
    if (!btn) return;

    btn.addEventListener("click", function () {
      var name = (qs('[data-profile-input-name]', page)?.value || "").trim();
      if (!name) {
        toast("error", "Ad alanı boş olamaz.");
        return;
      }

      try { localStorage.setItem("aivo_profile_name", name); } catch (e) {}

      text(qs('[data-profile-name]', page), name);
      text(qs('[data-profile-initial]', page), name.charAt(0).toUpperCase());
      toast("ok", "Profil güncellendi.");
    });
  }

  /* ===============================
     PASSWORD MODAL
     =============================== */
  function openPasswordModal() {
    var modal = qs('[data-password-modal]');
    if (!modal) return;
    modal.setAttribute("aria-hidden", "false");

    // reset fields
    var cur = qs("[data-pw-current]", modal);
    var nw = qs("[data-pw-new]", modal);
    var nw2 = qs("[data-pw-new2]", modal);
    if (cur) cur.value = "";
    if (nw) nw.value = "";
    if (nw2) nw2.value = "";

    // focus
    setTimeout(function(){ if (cur) cur.focus(); }, 0);
  }

  function closePasswordModal() {
    var modal = qs('[data-password-modal]');
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
  }

  function bindPasswordModal() {
    var modal = qs('[data-password-modal]');
    if (!modal) return;

    // open triggers (profile sayfasındaki buton)
    qsa("[data-open-password]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openPasswordModal();
      });
    });

    // close triggers
    qsa("[data-password-close]", modal).forEach(function (btn) {
      btn.addEventListener("click", function () {
        closePasswordModal();
      });
    });

    // esc close
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var isOpen = modal.getAttribute("aria-hidden") === "false";
        if (isOpen) closePasswordModal();
      }
    });

    // submit
    var submit = qs("[data-pw-submit]", modal);
    if (submit) {
      submit.addEventListener("click", function () {
        var cur = (qs("[data-pw-current]", modal)?.value || "").trim();
        var nw = (qs("[data-pw-new]", modal)?.value || "").trim();
        var nw2 = (qs("[data-pw-new2]", modal)?.value || "").trim();

        if (!cur || !nw || !nw2) {
          toast("error", "Lütfen tüm alanları doldur.");
          return;
        }
        if (nw.length < 8) {
          toast("error", "Yeni şifre en az 8 karakter olmalı.");
          return;
        }
        if (nw !== nw2) {
          toast("error", "Yeni şifreler eşleşmiyor.");
          return;
        }
        if (nw === cur) {
          toast("error", "Yeni şifre mevcut şifre ile aynı olamaz.");
          return;
        }

        // Backend henüz yoksa: şimdilik başarı simülasyonu
        // İleride: fetch('/api/profile/password', {method:'POST', ...}) bağlarız.
        toast("ok", "Şifre güncellendi.");
        closePasswordModal();
      });
    }
  }

  /* ===============================
     PAGE SWITCH SUPPORT
     =============================== */
  function observePage() {
    var mo = new MutationObserver(function () {
      var active = document.body.getAttribute("data-active-page");
      if (active === "profile") applyProfile();
    });

    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-active-page"]
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyProfile();
    bindSave();
    bindPasswordModal();
    observePage();
  });
})();
