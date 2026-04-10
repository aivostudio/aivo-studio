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
    return document.body.getAttribute("data-active-page") === "profile";
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

  function getCurrentProfileScopeEmail(page, auth) {
    return normalizeEmail(firstNonEmpty(
      page && qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value,
      page && qs("[data-profile-email]", page) && qs("[data-profile-email]", page).textContent,
      auth && auth.email,
      ""
    ));
  }

  function getScopedProfileName(email) {
    return (safeGetLS(getScopedProfileKey("aivo_profile_name", email)) || "").trim();
  }

  function getScopedProfileSurname(email) {
    return (safeGetLS(getScopedProfileKey("aivo_profile_surname", email)) || "").trim();
  }

  function setScopedProfileName(email, value) {
    safeSetLS(getScopedProfileKey("aivo_profile_name", email), value || "");
  }

  function setScopedProfileSurname(email, value) {
    safeSetLS(getScopedProfileKey("aivo_profile_surname", email), value || "");
  }

  function clearGlobalProfileCache() {
    safeSetLS("aivo_profile_name", "");
    safeSetLS("aivo_profile_surname", "");
  }

  function clearScopedProfileCache(email) {
    setScopedProfileName(email, "");
    setScopedProfileSurname(email, "");
  }

  function clearAuthIdentityButKeepEmail(email) {
    safeSetLS("aivo_auth_unified_v1", JSON.stringify({
      loggedIn: true,
      email: normalizeEmail(email),
      name: "",
      full_name: "",
      first_name: "",
      last_name: "",
      surname: "",
      ts: 0
    }));
  }

  function authMatchesEmail(auth, email) {
    return normalizeEmail(auth && auth.email) === normalizeEmail(email);
  }

  function hasUsableAuthIdentityForEmail(auth, email) {
    if (!authMatchesEmail(auth, email)) return false;
    return !!firstNonEmpty(
      auth && auth.full_name,
      auth && auth.name,
      auth && auth.first_name
    );
  }

  function readCreditsFromTopbar() {
    return "";
  }

  function readSpentCreditsFromProfilePage(page) {
    return "";
  }

  function readProfileData() {
    var page = getProfilePage();
    if (!page) return null;

    var auth = readJSON("aivo_auth_unified_v1");
    var scopeEmail = getCurrentProfileScopeEmail(page, auth);
    var scopedName = getScopedProfileName(scopeEmail);
    var scopedSurname = getScopedProfileSurname(scopeEmail);
    var canUseAuthIdentity = hasUsableAuthIdentityForEmail(auth, scopeEmail);

    var inputNameNow = firstNonEmpty(
      qs("[data-profile-input-name]", page) && qs("[data-profile-input-name]", page).value
    );

    var inputSurnameNow = firstNonEmpty(
      qs("[data-profile-input-surname]", page) && qs("[data-profile-input-surname]", page).value
    );

    var inputEmailNow = firstNonEmpty(
      qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value
    );

    var authFirstName = canUseAuthIdentity ? firstNonEmpty(
      auth.first_name,
      auth.name
    ) : "";

    var authSurname = canUseAuthIdentity ? firstNonEmpty(
      auth.surname,
      auth.last_name,
      auth.lastName
    ) : "";

    var authFullName = canUseAuthIdentity ? firstNonEmpty(
      auth.full_name,
      auth.fullName
    ) : "";

    var name = firstNonEmpty(
      inputNameNow,
      authFirstName,
      scopedName
    );

    var surname = firstNonEmpty(
      inputSurnameNow,
      authSurname,
      scopedSurname
    );

    var fullName = firstNonEmpty(
      authFullName,
      (name && surname) ? (name + " " + surname).trim() : "",
      name,
      "Kullanıcı"
    );

    var email = firstNonEmpty(
      inputEmailNow,
      scopeEmail,
      auth.email,
      "—"
    );

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
      name: fullName,
      surname: surname,
      email: email,
      plan: plan,
      credit: "0",
      spent: "0"
    };
  }

  function applyProfile() {
    var page = getProfilePage();

    if (!page) return;
    if (!isProfileActive()) return;

    var data = readProfileData();
    if (!data) return;

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

    value(inputNameEl, data.name || "");
    value(inputSurnameEl, data.surname || "");
    value(inputEmailEl, data.email || "");
  }

  async function hydrateProfileFromApi() {
    var page = getProfilePage();
    if (!page) return false;

    try {
      var res = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store"
      });

      if (!res.ok) return false;

      var me = await res.json();
      if (!me) return false;

      var email = normalizeEmail(firstNonEmpty(
        me.email,
        me.user && me.user.email,
        ""
      ));

      var firstName = firstNonEmpty(
        me.first_name,
        me.firstName,
        me.name,
        me.user && me.user.first_name,
        me.user && me.user.firstName,
        me.user && me.user.name,
        ""
      );

      var lastName = firstNonEmpty(
        me.last_name,
        me.lastName,
        me.surname,
        me.user && me.user.last_name,
        me.user && me.user.lastName,
        me.user && me.user.surname,
        ""
      );

      if (!email && !firstName && !lastName) return false;

      var emailName = "";
      if (email && email.indexOf("@") !== -1) {
        emailName = email.split("@")[0].trim();
      }

      var resolvedName = firstNonEmpty(firstName, emailName, "Kullanıcı");
      var resolvedSurname = firstNonEmpty(lastName, "");
      var resolvedFullName = firstNonEmpty(
        (resolvedName && resolvedSurname) ? (resolvedName + " " + resolvedSurname) : "",
        resolvedName,
        "Kullanıcı"
      );

      safeSetLS("aivo_auth_unified_v1", JSON.stringify({
        loggedIn: true,
        email: email,
        name: resolvedName,
        full_name: resolvedFullName,
        first_name: resolvedName,
        last_name: resolvedSurname,
        surname: resolvedSurname,
        ts: Date.now()
      }));

      clearGlobalProfileCache();
      clearScopedProfileCache(email);
      setScopedProfileName(email, resolvedName);
      setScopedProfileSurname(email, resolvedSurname);

      value(qs("[data-profile-input-name]", page), resolvedName || "");
      value(qs("[data-profile-input-surname]", page), resolvedSurname || "");
      value(qs("[data-profile-input-email]", page), email || "");

      text(qs("[data-profile-name]", page), resolvedFullName);
      text(qs("[data-profile-email]", page), email || "—");
      text(qs("[data-profile-initial]", page), resolvedFullName.charAt(0).toUpperCase());

      document.dispatchEvent(new CustomEvent("aivo:profile-saved", {
        detail: {
          name: resolvedName || "",
          surname: resolvedSurname || "",
          fullName: resolvedFullName,
          email: email || ""
        }
      }));

      return true;
    } catch (err) {
      console.warn("[profile.section] hydrateProfileFromApi failed", err);
      return false;
    }
  }

  function bindSave() {
    var page = getProfilePage();
    if (!page) return;

    var btn = qs("[data-profile-save]", page);
    if (!btn) return;

    if (btn.__aivoProfileSectionBound) return;
    btn.__aivoProfileSectionBound = true;

    btn.addEventListener("click", function () {
      var name = firstNonEmpty(
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

      if (!name) {
        if (window.toast && window.toast.error) window.toast.error("Ad alanı boş olamaz.");
        return;
      }

      var auth = readJSON("aivo_auth_unified_v1");
      auth.name = name;
      auth.first_name = name;
      auth.surname = surname;
      auth.last_name = surname;
      auth.full_name = surname ? (name + " " + surname).trim() : name;
      auth.email = firstNonEmpty(auth.email, email, "");
      auth.loggedIn = true;
      auth.ts = Date.now();
      safeSetLS("aivo_auth_unified_v1", JSON.stringify(auth));

      clearGlobalProfileCache();
      clearScopedProfileCache(auth.email);
      setScopedProfileName(auth.email, name);
      setScopedProfileSurname(auth.email, surname);

      var fullName = surname ? (name + " " + surname).trim() : name;

      text(qs("[data-profile-name]", page), fullName);
      text(qs("[data-profile-email]", page), firstNonEmpty(auth.email, email, "—"));
      text(qs("[data-profile-initial]", page), fullName.charAt(0).toUpperCase());

      value(qs("[data-profile-input-name]", page), name || "");
      value(qs("[data-profile-input-surname]", page), surname || "");
      value(qs("[data-profile-input-email]", page), firstNonEmpty(auth.email, email, "—"));

      document.dispatchEvent(new CustomEvent("aivo:profile-saved", {
        detail: {
          name: name,
          surname: surname,
          fullName: fullName,
          email: firstNonEmpty(auth.email, email, "")
        }
      }));

      if (window.toast && window.toast.success) {
        window.toast.success("Profil güncellendi.");
      }
    });
  }

  async function ensureFreshProfileIdentity(page, auth) {
    var pageEmail = getCurrentProfileScopeEmail(page, auth);
    var authEmail = normalizeEmail(auth && auth.email);
    var currentEmail = normalizeEmail(firstNonEmpty(pageEmail, authEmail, ""));
    var hydratedEmail = normalizeEmail(window.__aivoProfileHydratedEmail || "");
    var hydrateInFlight = !!window.__aivoProfileHydrateInFlight;
    var lastHydrateAt = Number(window.__aivoProfileHydrateAt || 0);
    var now = Date.now();

    if (!currentEmail) {
      currentEmail = authEmail;
    }

    if (!currentEmail) {
      if (!hydrateInFlight) {
        window.__aivoProfileHydrateInFlight = true;
        try {
          var okNoEmail = await hydrateProfileFromApi();
          if (okNoEmail) {
            window.__aivoProfileHydrateAt = Date.now();
            window.__aivoProfileHydratedEmail = normalizeEmail(readJSON("aivo_auth_unified_v1").email);
          }
        } finally {
          window.__aivoProfileHydrateInFlight = false;
        }
      }
      return;
    }

    if (authEmail && currentEmail && authEmail !== currentEmail) {
      clearGlobalProfileCache();
      clearScopedProfileCache(authEmail);
      clearAuthIdentityButKeepEmail(currentEmail);
      auth = readJSON("aivo_auth_unified_v1");
    }

    var authValidForCurrentEmail = hasUsableAuthIdentityForEmail(auth, currentEmail);
    var scopedName = getScopedProfileName(currentEmail);
    var needsHydrate =
      !authValidForCurrentEmail ||
      !scopedName ||
      hydratedEmail !== currentEmail ||
      (now - lastHydrateAt) > 15000;

    if (needsHydrate && !hydrateInFlight) {
      window.__aivoProfileHydrateInFlight = true;
      try {
        var ok = await hydrateProfileFromApi();
        if (ok) {
          window.__aivoProfileHydrateAt = Date.now();
          window.__aivoProfileHydratedEmail = normalizeEmail(readJSON("aivo_auth_unified_v1").email);
        }
      } finally {
        window.__aivoProfileHydrateInFlight = false;
      }
    }
  }

  async function renderProfileNow() {
    var page = getProfilePage();
    if (!page) return false;

    bindSave();

    var auth = readJSON("aivo_auth_unified_v1");

    if (isProfileActive()) {
      await ensureFreshProfileIdentity(page, auth);
      applyProfile();
    } else {
      var initialEl = qs("[data-profile-initial]", page);
      var nameEl = qs("[data-profile-name]", page);
      var emailEl = qs("[data-profile-email]", page);

      var email = normalizeEmail(firstNonEmpty(
        qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value,
        auth.email,
        ""
      ));

      var scopedName = getScopedProfileName(email);
      var scopedSurname = getScopedProfileSurname(email);
      var displayName = firstNonEmpty(
        hasUsableAuthIdentityForEmail(auth, email) ? auth.full_name : "",
        hasUsableAuthIdentityForEmail(auth, email) ? auth.name : "",
        (scopedName && scopedSurname) ? (scopedName + " " + scopedSurname).trim() : "",
        scopedName,
        ""
      );

      if (email) {
        value(qs("[data-profile-input-email]", page), email);
        text(emailEl, email);
      }

      if (displayName) {
        text(nameEl, displayName);
        text(initialEl, displayName.charAt(0).toUpperCase());
      }
    }

    var hasEmail =
      firstNonEmpty(
        qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value,
        qs("[data-profile-email]", page) && qs("[data-profile-email]", page).textContent,
        ""
      ) !== "";

    var hasName =
      firstNonEmpty(
        qs("[data-profile-name]", page) && qs("[data-profile-name]", page).textContent,
        ""
      ) !== "";

    var hasInitial =
      firstNonEmpty(
        qs("[data-profile-initial]", page) && qs("[data-profile-initial]", page).textContent,
        ""
      ) !== "";

    return !!(hasEmail && hasName && hasInitial);
  }

  function observePage() {
    if (window.__aivoProfileSectionObserverBound) return;
    window.__aivoProfileSectionObserverBound = true;

    var lastActivePage = document.body.getAttribute("data-active-page") || "";

    var mo = new MutationObserver(async function () {
      var nextActivePage = document.body.getAttribute("data-active-page") || "";
      if (nextActivePage === lastActivePage) return;

      lastActivePage = nextActivePage;

      if (nextActivePage === "profile") {
        await renderProfileNow();
      }
    });

    mo.observe(document.body, {
      subtree: false,
      childList: false,
      attributes: true,
      attributeFilter: ["data-active-page"]
    });
  }

  async function bootProfileRender(retries, delay) {
    var left = Number(retries || 0);
    var wait = Number(delay || 0);

    while (left > 0) {
      var ok = await renderProfileNow();
      if (ok) return;

      await new Promise(function (resolve) {
        setTimeout(resolve, wait);
      });

      left -= 1;
    }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    observePage();
    await bootProfileRender(20, 200);
  });

  window.addEventListener("load", async function () {
    await bootProfileRender(10, 200);
  });

  document.addEventListener("visibilitychange", async function () {
    if (!document.hidden) {
      await bootProfileRender(6, 150);
    }
  });
})();
