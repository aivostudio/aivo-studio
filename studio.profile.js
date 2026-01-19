/* =========================================================
   studio.profile.js — FINAL (STABILIZED / TOPBAR-BAĞIMSIZ)
   - Tek dosya: profil binder + password modal
   - Çift bind / cache kaynaklı karışıklık riskini azaltır
   - Safari Keychain dropdown "takılı kalmasın" fix
   ========================================================= */
(function () {
  "use strict";
/* ===============================
   HELPERS (CLEAN — NO TOAST)
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
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

function safeSetLS(key, val) {
  try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
}

function getProfilePage() {
  return qs('.page-profile[data-page="profile"]');
}

function isProfileActive() {
  return document.body.getAttribute("data-active-page") === "profile";
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

    var planText = (qs("[data-profile-plan]", page)?.textContent || "").trim();
    var creditText = (qs("[data-profile-credit]", page)?.textContent || "").trim();

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

    // Profil aktif değilken apply basmayalım (sayfa karışıklığı riskini azaltır)
    if (!isProfileActive()) return;

    var data = readProfileData();
    if (!data) return;

    var initial = (data.name || "K").charAt(0).toUpperCase();
    text(qs("[data-profile-initial]", page), initial);

    text(qs("[data-profile-name]", page), data.name);
    text(qs("[data-profile-email]", page), data.email);

    var planEls = qsa("[data-profile-plan]", page);
    for (var i = 0; i < planEls.length; i++) planEls[i].textContent = "Plan: " + data.plan;

    var creditEls = qsa("[data-profile-credit]", page);
    for (var j = 0; j < creditEls.length; j++) creditEls[j].textContent = "Kredi: " + data.credit;

    // Inputları sadece profil aktifken basıyoruz
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

    if (btn.__aivoBound) return;
    btn.__aivoBound = true;

    btn.addEventListener("click", function () {
      var name = (qs("[data-profile-input-name]", page)?.value || "").trim();
      if (!name) {
      window.toast.error("Ad alanı boş olamaz.");

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
      if (isProfileActive()) {
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
     PASSWORD MODAL (PROFILE) — STABLE + SAFARI FIX
     ========================================================= */
  function bindPasswordModal() {
    // Eğer dosya iki kere yüklense bile handlerlar tek bağlansın
    if (window.__aivoPasswordModalHandlersBound) return;
    window.__aivoPasswordModalHandlersBound = true;

    function getModal() { return qs("[data-password-modal]"); }

    function isOpen(modal) {
      return modal && modal.getAttribute("aria-hidden") === "false";
    }

    function openModal() {
      var modal = getModal();
      if (!modal) return;

      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("is-open");
      document.body.classList.add("modal-open");

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

      // ✅ Safari / Keychain dropdown takılmasın: önce focus'u bırak
      var active = document.activeElement;
      if (active && modal.contains(active) && typeof active.blur === "function") {
        active.blur();
      }

      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
      document.body.classList.remove("modal-open");

      var inputs = qsa("input", modal);
      for (var i = 0; i < inputs.length; i++) inputs[i].value = "";
    }

    // Delegated click (tek kez)
    document.addEventListener("click", function (e) {
      var t = e.target;

      var openBtn = t.closest && t.closest("[data-open-password]");
      if (openBtn) {
        e.preventDefault();
        openModal();
        return;
      }

      var closeBtn = t.closest && t.closest("[data-password-close]");
      if (closeBtn) {
        e.preventDefault();
        closeModal();
        return;
      }

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

        console.log("PASSWORD CHANGE OK (frontend):", { current: curV, next: n1V });
        toast("ok", "Şifre başarıyla güncellendi.");
        closeModal();
      }
    }, true);

    // ESC (tek kez)
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var modal = getModal();
      if (modal && isOpen(modal)) closeModal();
    });
  }

  /* ===============================
     INIT
     =============================== */
  document.addEventListener("DOMContentLoaded", function () {
    // İlk yükte body data-active-page profile değilse apply basmayız (safe)
    bindSave();
    observePage();
    bindPasswordModal();

    // Eğer sayfa direkt profile ile açılıyorsa:
    if (isProfileActive()) applyProfile();
  });
})();
// ================= AIVO STUDIO — AUTH UI HYDRATE (email/name/initial) =================
(function(){
  function readAuth(){
    try { return JSON.parse(localStorage.getItem("aivo_auth_unified_v1") || "{}"); }
    catch(e){ return {}; }
  }

  function setText(sel, val){
    var el = document.querySelector(sel);
    if (el) el.textContent = val;
  }

  function hydrate(){
    var a = readAuth();
    var email = (a && a.email) ? String(a.email) : "";
    if (!email) return;

    // Studio’da kullanılan hedefler (hangisi varsa yazar)
    setText("#umEmail", email);
    setText("#topUserEmail", email);
    setText("#topUserName", "Hesap");

    // initial (email’den)
    var initial = email.trim().charAt(0).toUpperCase();
    setText("#topUserInitial", initial);
    setText("#umAvatar", initial);
  }

  if (document.readyState === "complete") hydrate();
  else window.addEventListener("load", hydrate);

  // Studio’da bazı paneller sonradan render oluyorsa 1-2 sn retry
  var i=0;
  var t=setInterval(function(){
    i++;
    hydrate();
    if (i>=30) clearInterval(t); // ~3s
  }, 100);
})();
