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
(function () {
  "use strict";

  if (window.__aivoPasswordModalBound) return;
  window.__aivoPasswordModalBound = true;

  var modal = document.querySelector("[data-password-modal]");
  if (!modal) return;

  var panel = modal.querySelector(".aivo-modal__panel");

  function openModal() {
    modal.removeAttribute("aria-hidden");
    modal.classList.add("is-open");
    document.body.classList.add("modal-open");

    // ilk input’a odak (Safari safe)
    setTimeout(function () {
      var first = modal.querySelector("[data-pw-current]");
      if (first) first.focus();
    }, 0);
  }

  function closeModal() {
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");

    // inputları temizle
    modal.querySelectorAll("input").forEach(function (i) {
      i.value = "";
    });
  }

  // AÇ
  document.addEventListener("click", function (e) {
    var openBtn = e.target.closest("[data-open-password]");
    if (openBtn) {
      e.preventDefault();
      openModal();
    }
  });

  // KAPA (x, backdrop, iptal)
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-password-close]")) {
      e.preventDefault();
      closeModal();
    }
  });

  // ESC ile kapat
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hasAttribute("aria-hidden")) {
      closeModal();
    }
  });

  // SUBMIT (şimdilik frontend validation)
  document.addEventListener("click", function (e) {
    var submit = e.target.closest("[data-pw-submit]");
    if (!submit) return;

    var cur = modal.querySelector("[data-pw-current]");
    var n1  = modal.querySelector("[data-pw-new]");
    var n2  = modal.querySelector("[data-pw-new2]");

    if (!cur.value || !n1.value || !n2.value) {
      alert("Lütfen tüm alanları doldurun.");
      return;
    }

    if (n1.value.length < 8) {
      alert("Yeni şifre en az 8 karakter olmalı.");
      return;
    }

    if (n1.value !== n2.value) {
      alert("Yeni şifreler eşleşmiyor.");
      return;
    }

    // TODO: API entegrasyonu burada
    console.log("PASSWORD CHANGE OK (frontend):", {
      current: cur.value,
      next: n1.value
    });

    alert("Şifre başarıyla güncellendi.");
    closeModal();
  });

})();

