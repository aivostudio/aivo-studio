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
