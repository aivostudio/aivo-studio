(function () {
  "use strict";

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

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); }
    catch (e) { return {}; }
  }

  function getProfilePage() {
    var pages = qsa('.page-profile[data-page="profile"]');
    for (var i = 0; i < pages.length; i++) {
      var page = pages[i];
      if (page && page.isConnected) return page;
    }

    var fallbackPages = qsa('[data-page="profile"]');
    for (var j = 0; j < fallbackPages.length; j++) {
      var fallbackPage = fallbackPages[j];
      if (fallbackPage && fallbackPage.isConnected) return fallbackPage;
    }

    return null;
  }

function isProfileActive() {
  if (document.body.getAttribute("data-active-page") === "profile") return true;

  var page = getProfilePage();
  if (!page) return false;

  return !!(page && page.isConnected);
}

  function firstNonEmpty() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getScopedProfileKey(baseKey, email) {
    var normalized = normalizeEmail(email);
    if (!normalized) return baseKey;
    return baseKey + ":" + normalized;
  }

  function getScopedProfileName(email) {
    return (safeGetLS(getScopedProfileKey("aivo_profile_name", email)) || "").trim();
  }

  function getScopedProfileSurname(email) {
    return (safeGetLS(getScopedProfileKey("aivo_profile_surname", email)) || "").trim();
  }

  function setScopedProfileName(email, val) {
    safeSetLS(getScopedProfileKey("aivo_profile_name", email), val || "");
  }

  function setScopedProfileSurname(email, val) {
    safeSetLS(getScopedProfileKey("aivo_profile_surname", email), val || "");
  }

  function clearGlobalProfileCache() {
    safeSetLS("aivo_profile_name", "");
    safeSetLS("aivo_profile_surname", "");
  }

  function clearScopedProfileCache(email) {
    safeSetLS(getScopedProfileKey("aivo_profile_name", email), "");
    safeSetLS(getScopedProfileKey("aivo_profile_surname", email), "");
  }

  function authMatchesEmail(auth, email) {
    return normalizeEmail(auth && auth.email) === normalizeEmail(email);
  }

  function emailToDisplayName(email) {
    var normalized = normalizeEmail(email);
    if (!normalized || normalized.indexOf("@") === -1) return "";
    return normalized.split("@")[0].trim();
  }

function getCurrentScopeEmail(page, auth) {
  return normalizeEmail(firstNonEmpty(
    auth && auth.email,
    safeGetLS("aivo_user_email"),
    page && qs("[data-profile-email]", page) && qs("[data-profile-email]", page).textContent,
    page && qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value,
    ""
  ));
}

  function buildFullName(name, surname, email) {
    var full = firstNonEmpty(
      (name && surname) ? (name + " " + surname).trim() : "",
      name,
      emailToDisplayName(email),
      "Kullanıcı"
    );
    return full;
  }

  function readProfileData() {
    var page = getProfilePage();
    if (!page) return null;

    var auth = readJSON("aivo_auth_unified_v1");
    var scopeEmail = getCurrentScopeEmail(page, auth);

    var inputNameNow = firstNonEmpty(
      qs("[data-profile-input-name]", page) && qs("[data-profile-input-name]", page).value
    );

    var inputSurnameNow = firstNonEmpty(
      qs("[data-profile-input-surname]", page) && qs("[data-profile-input-surname]", page).value
    );

    var inputEmailNow = normalizeEmail(firstNonEmpty(
      qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value
    ));

    var domNameNow = firstNonEmpty(
      qs("[data-profile-name]", page) && qs("[data-profile-name]", page).textContent
    );

    var domEmailNow = normalizeEmail(firstNonEmpty(
      qs("[data-profile-email]", page) && qs("[data-profile-email]", page).textContent
    ));

   var email = normalizeEmail(firstNonEmpty(
  auth && auth.email,
  scopeEmail,
  domEmailNow,
  inputEmailNow,
  ""
));

    var scopedName = getScopedProfileName(email);
    var scopedSurname = getScopedProfileSurname(email);

    var authName = authMatchesEmail(auth, email)
      ? firstNonEmpty(auth && auth.first_name, auth && auth.name)
      : "";

    var authSurname = authMatchesEmail(auth, email)
      ? firstNonEmpty(auth && auth.surname, auth && auth.last_name, auth && auth.lastName)
      : "";

    var name = firstNonEmpty(
      inputNameNow,
      scopedName,
      authName,
      domNameNow && domNameNow !== "Kullanıcı" ? domNameNow : "",
      emailToDisplayName(email)
    );

    var surname = firstNonEmpty(
      inputSurnameNow,
      scopedSurname,
      authSurname
    );

    var fullName = buildFullName(name, surname, email);

    var planText = firstNonEmpty(
      qs("[data-profile-plan]", page) && qs("[data-profile-plan]", page).textContent,
      qs("#umPlan") && qs("#umPlan").textContent,
      "Basic"
    );

    var plan = "Basic";

    if (planText) {
      var pm = String(planText).match(/Plan:\s*(.+)$/i);
      if (pm && pm[1]) plan = pm[1].trim();
      else plan = String(planText).trim();
    }

    return {
      firstName: firstNonEmpty(name, emailToDisplayName(email), "Kullanıcı"),
      surname: surname,
      name: fullName,
      email: firstNonEmpty(email, "—"),
      plan: plan,
      credit: "0",
      spent: "0"
    };
  }

  function syncAuthAndScopedCacheFromProfileData(data) {
    if (!data) return;

    var email = normalizeEmail(data.email);
    if (!email || email === "—") return;

    var firstName = firstNonEmpty(data.firstName, emailToDisplayName(email), "Kullanıcı");
    var surname = firstNonEmpty(data.surname, "");
    var fullName = buildFullName(firstName, surname, email);

    var auth = readJSON("aivo_auth_unified_v1");
    auth.loggedIn = true;
    auth.email = email;
    auth.name = firstName;
    auth.first_name = firstName;
    auth.surname = surname;
    auth.last_name = surname;
    auth.full_name = fullName;
    auth.ts = Date.now();
    safeSetLS("aivo_auth_unified_v1", JSON.stringify(auth));

    clearGlobalProfileCache();
    setScopedProfileName(email, firstName);
    setScopedProfileSurname(email, surname);
  }

  function applyProfile() {
    var page = getProfilePage();
    if (!page) return;
    if (!isProfileActive()) return;

    var data = readProfileData();
    if (!data) return;

    syncAuthAndScopedCacheFromProfileData(data);

    var initial = (data.name || "K").charAt(0).toUpperCase();

    var initialEl = qs("[data-profile-initial]", page);
    var nameEl = qs("[data-profile-name]", page);
    var emailEl = qs("[data-profile-email]", page);
    var inputNameEl = qs("[data-profile-input-name]", page);
    var inputSurnameEl = qs("[data-profile-input-surname]", page);
    var inputEmailEl = qs("[data-profile-input-email]", page);

    text(initialEl, initial);
    text(nameEl, data.name);
    text(emailEl, data.email);

    var planEls = qsa("[data-profile-plan]", page);
    for (var i = 0; i < planEls.length; i++) {
      planEls[i].textContent = "Plan: " + data.plan;
    }

    var creditEls = qsa("[data-profile-credit]", page);
    for (var j = 0; j < creditEls.length; j++) {
      creditEls[j].textContent = "Kredi: " + data.credit;
    }

    value(inputNameEl, data.firstName || "");
    value(inputSurnameEl, data.surname || "");
    value(inputEmailEl, data.email || "");
  }

  function bindSave() {
    var page = getProfilePage();
    if (!page) return;

    var btn = qs("[data-profile-save]", page);
    if (!btn) return;

    if (btn.__aivoProfileSectionBound) return;
    btn.__aivoProfileSectionBound = true;

    btn.addEventListener("click", function () {
      var firstName = firstNonEmpty(
        qs("[data-profile-input-name]", page) && qs("[data-profile-input-name]", page).value
      );

      var surname = firstNonEmpty(
        qs("[data-profile-input-surname]", page) && qs("[data-profile-input-surname]", page).value
      );

      var email = normalizeEmail(firstNonEmpty(
        readJSON("aivo_auth_unified_v1").email,
        qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value,
        qs("[data-profile-email]", page) && qs("[data-profile-email]", page).textContent,
        ""
      ));

      if (!firstName) {
        if (window.toast && window.toast.error) window.toast.error("Ad alanı boş olamaz.");
        return;
      }

      var fullName = buildFullName(firstName, surname, email);

      var auth = readJSON("aivo_auth_unified_v1");
      auth.loggedIn = true;
      auth.email = email;
      auth.name = firstName;
      auth.first_name = firstName;
      auth.surname = surname;
      auth.last_name = surname;
      auth.full_name = fullName;
      auth.ts = Date.now();
      safeSetLS("aivo_auth_unified_v1", JSON.stringify(auth));

      clearGlobalProfileCache();
      clearScopedProfileCache(email);
      setScopedProfileName(email, firstName);
      setScopedProfileSurname(email, surname);

      text(qs("[data-profile-name]", page), fullName);
      text(qs("[data-profile-email]", page), firstNonEmpty(email, "—"));
      text(qs("[data-profile-initial]", page), fullName.charAt(0).toUpperCase());

      value(qs("[data-profile-input-name]", page), firstName || "");
      value(qs("[data-profile-input-surname]", page), surname || "");
      value(qs("[data-profile-input-email]", page), firstNonEmpty(email, "—"));

      document.dispatchEvent(new CustomEvent("aivo:profile-saved", {
        detail: {
          name: firstName,
          surname: surname,
          fullName: fullName,
          email: firstNonEmpty(email, "")
        }
      }));

      if (window.toast && window.toast.success) {
        window.toast.success("Profil güncellendi.");
      }
    });
  }

  function renderProfileNow() {
    var page = getProfilePage();
    if (!page) return false;

    bindSave();

    var auth = readJSON("aivo_auth_unified_v1");
    var data = readProfileData();

    if (isProfileActive()) {
      applyProfile();
    } else {
      var initialEl = qs("[data-profile-initial]", page);
      var nameEl = qs("[data-profile-name]", page);
      var emailEl = qs("[data-profile-email]", page);
      var inputEmailEl = qs("[data-profile-input-email]", page);

      var email = normalizeEmail(firstNonEmpty(
        data && data.email,
        auth && auth.email,
        ""
      ));

      var displayName = firstNonEmpty(
        data && data.name,
        authMatchesEmail(auth, email) ? auth.full_name : "",
        authMatchesEmail(auth, email) ? auth.name : "",
        emailToDisplayName(email),
        "Kullanıcı"
      );

      if (email) {
        value(inputEmailEl, email);
        text(emailEl, email);
      }

      if (displayName) {
        text(nameEl, displayName);
        text(initialEl, displayName.charAt(0).toUpperCase());
      }
    }

   var resolvedEmail = firstNonEmpty(
  qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value,
  qs("[data-profile-email]", page) && qs("[data-profile-email]", page).textContent,
  ""
).trim();

var resolvedName = firstNonEmpty(
  qs("[data-profile-name]", page) && qs("[data-profile-name]", page).textContent,
  ""
).trim();

var resolvedInitial = firstNonEmpty(
  qs("[data-profile-initial]", page) && qs("[data-profile-initial]", page).textContent,
  ""
).trim();

var hasRealEmail =
  !!resolvedEmail &&
  resolvedEmail !== "—" &&
  resolvedEmail.indexOf("@") !== -1;

var hasRealName =
  !!resolvedName &&
  resolvedName !== "Kullanıcı" &&
  resolvedName !== "—";

var hasRealInitial =
  !!resolvedInitial &&
  resolvedInitial !== "K";

return !!(hasRealEmail && hasRealName && hasRealInitial);
  }
function observePage() {
  if (window.__aivoProfileSectionObserverBound) return;
  window.__aivoProfileSectionObserverBound = true;

  var lastActivePage = document.body.getAttribute("data-active-page") || "";

  function triggerProfileRenderSoon() {
    setTimeout(function () {
      renderProfileNow();
    }, 0);

    setTimeout(function () {
      renderProfileNow();
    }, 120);

    setTimeout(function () {
      renderProfileNow();
    }, 300);
  }

  if (lastActivePage === "profile") {
    triggerProfileRenderSoon();
  }

  var mo = new MutationObserver(function () {
    var nextActivePage = document.body.getAttribute("data-active-page") || "";
    if (nextActivePage === lastActivePage) return;

    lastActivePage = nextActivePage;

    if (nextActivePage === "profile") {
      triggerProfileRenderSoon();
    }
  });

  mo.observe(document.body, {
    subtree: false,
    childList: false,
    attributes: true,
    attributeFilter: ["data-active-page"]
  });
}

  var host = document.getElementById("moduleHost") || document.body;

  var domMo = new MutationObserver(function () {
    if (getProfilePage()) {
      triggerProfileRenderSoon();
    }
  });

  domMo.observe(host, {
    subtree: true,
    childList: true
  });
}

  function bootProfileRender(retries, delay) {
    var left = Number(retries || 0);
    var wait = Number(delay || 0);

    function tick() {
      var ok = renderProfileNow();
      if (ok) return;

      left -= 1;
      if (left <= 0) return;

      setTimeout(tick, wait);
    }

    tick();
  }

  document.addEventListener("DOMContentLoaded", function () {
    observePage();
    bootProfileRender(20, 200);
  });

  window.addEventListener("load", function () {
    bootProfileRender(10, 200);
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      bootProfileRender(6, 150);
    }
  });
})();
