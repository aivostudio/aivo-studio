/* =========================================================
   PROFILE BIND (SAFE)
   - Profil sayfasındaki statik metinleri store/topbar/localStorage'dan besler
   - Click engellemez
   - Backend yoksa bile düzgün placeholder gösterir
   ========================================================= */
(function () {
  "use strict";

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function txt(el, value){ if (el) el.textContent = value; }
  function val(el, value){ if (el) el.value = value; }

  function readTopbar() {
    // Topbar’da sizde "Harun" ve "Kredi 2899" görünüyor.
    // Bu iki alanın class/selector’ı projede değişebiliyor.
    // O yüzden agresif değil, fallback’li arıyoruz.

    var name = "";
    var credit = "";

    // Kullanıcı adı: chip / dropdown tetikleyici vb.
    var userEl =
      qs('[data-user-name]') ||
      qs('.user-name') ||
      qs('.topbar .user-chip') ||
      qs('.topbar [aria-label*="user"]') ||
      null;

    if (userEl) name = (userEl.textContent || "").trim();

    // Kredi: "Kredi 2899" yazan buton/chip
    var creditEl =
      qs('[data-credit]') ||
      qs('.credit-chip') ||
      qs('.topbar .chip-btn') ||
      null;

    if (creditEl) {
      var t = (creditEl.textContent || "").trim();
      // "Kredi 2899" -> 2899
      var m = t.match(/(\d[\d\.\s]*)/);
      if (m) credit = String(m[1]).replace(/\s+/g, "");
    }

    return { name: name, credit: credit };
  }

  function readLocal() {
    // Sizde store.js var. Ama kesin API bilmediğimiz için localStorage fallback’i koyuyoruz.
    // İstersen ileride burada store integration’ı güçlendiririz.
    var email = (localStorage.getItem("aivo_user_email") || "").trim();
    var name  = (localStorage.getItem("aivo_user_name") || "").trim();
    var plan  = (localStorage.getItem("aivo_user_plan") || "").trim();
    var credit = (localStorage.getItem("aivo_user_credit") || "").trim();
    return { email: email, name: name, plan: plan, credit: credit };
  }

  function readStoreIfAny() {
    // Eğer ileride window.AIVO_STORE gibi bir şey varsa buradan okur.
    // Şu an “varsa okur, yoksa geçer” şeklinde SAFE.
    try {
      var s = window.AIVO_STORE || window.AIVO || null;
      if (!s) return {};
      // olası alan adları:
      var user = s.user || s.currentUser || {};
      return {
        name: (user.name || user.full_name || "").trim(),
        email: (user.email || "").trim(),
        plan: (user.plan || user.tier || "").trim(),
        credit: String(user.credit || user.credits || "").trim(),
      };
    } catch(e) {
      return {};
    }
  }

  function normalize(data) {
    var name = data.name || "Harun";
    var email = data.email || "harun@example.com";
    var plan = data.plan || "Basic";
    var credit = data.credit || "—";

    // credit sayısal ise normalize
    if (credit && credit !== "—") {
      credit = String(credit).replace(/[^\d]/g, "");
      if (!credit) credit = "—";
    }

    return { name: name, email: email, plan: plan, credit: credit };
  }

  function applyProfile() {
    var page = qs('.page-profile[data-page="profile"]');
    if (!page) return;

    // Kaynakları sırayla birleştir: Store > Local > Topbar
    var a = readStoreIfAny();
    var b = readLocal();
    var c = readTopbar();

    var merged = {
      name: a.name || b.name || c.name,
      email: a.email || b.email,
      plan: a.plan || b.plan,
      credit: a.credit || b.credit || c.credit
    };

    var d = normalize(merged);

    // Ribbon
    txt(qs(".page-profile .profile-avatar"), (d.name || "H").trim().slice(0,1).toUpperCase());
    txt(qs(".page-profile .profile-name"), d.name);
    txt(qs(".page-profile .profile-mail"), d.email);

    // Ribbon chips (Plan/Kredi)
    var chips = page.querySelectorAll(".profile-meta .chip");
    if (chips && chips.length >= 2) {
      txt(chips[0], "Plan: " + d.plan);
      txt(chips[1], "Kredi: " + d.credit);
    }

    // Sağ panel
    var items = page.querySelectorAll(".right-panel .right-item");
    if (items && items.length >= 2) {
      txt(items[0], "Plan: " + d.plan);
      txt(items[1], "Mevcut Kredi: " + d.credit);
    }

    // Form alanları (placeholder)
    // Not: Soyad şimdilik boş, çünkü “Ad Soyad” parse etmek riskli.
    val(qs(".page-profile .profile-form input[type='text']"), d.name);
    val(qs(".page-profile .profile-form input[type='email']"), d.email);
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyProfile();

    // Sayfa değişimlerinde tekrar basmak için:
    // sidebar.sync zaten body[data-active-page] set ediyor. Bu event’e takılabiliriz.
    var mo = new MutationObserver(function () { applyProfile(); });
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-active-page"] });
  });
})();
