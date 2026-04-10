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

    var cachedName = (safeGetLS("aivo_profile_name") || "").trim();
    var cachedSurname = (safeGetLS("aivo_profile_surname") || "").trim();

    var inputNameNow = firstNonEmpty(
      qs("[data-profile-input-name]", page) && qs("[data-profile-input-name]", page).value
    );

    var inputSurnameNow = firstNonEmpty(
      qs("[data-profile-input-surname]", page) && qs("[data-profile-input-surname]", page).value
    );

    var inputEmailNow = firstNonEmpty(
      qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value
    );

    var name = firstNonEmpty(
      inputNameNow,
      auth.first_name,
      auth.name,
      auth.full_name,
      auth.fullName,
      auth.username,
      qs("[data-profile-name]", page) && qs("[data-profile-name]", page).textContent,
      cachedName
    );

    var surname = firstNonEmpty(
      inputSurnameNow,
      auth.surname,
      auth.last_name,
      auth.lastName,
      cachedSurname
    );

    var fullName = name || "Kullanıcı";
    if (surname && fullName.toLowerCase().indexOf(surname.toLowerCase()) === -1) {
      fullName = (fullName + " " + surname).trim();
    }

    var email = firstNonEmpty(
      inputEmailNow,
      auth.email,
      qs("[data-profile-email]", page) && qs("[data-profile-email]", page).textContent,
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

    console.log("[profile.section] applyProfile:start", {
      hasPage: !!page,
      isProfileActive: isProfileActive(),
      activePageAttr: document.body.getAttribute("data-active-page")
    });

    if (!page) {
      console.warn("[profile.section] applyProfile aborted: page not found");
      return;
    }

    if (!isProfileActive()) {
      console.warn("[profile.section] applyProfile aborted: profile not active");
      return;
    }

    var data = readProfileData();

    console.log("[profile.section] applyProfile:data", data);

    if (!data) {
      console.warn("[profile.section] applyProfile aborted: no data");
      return;
    }

    var initial = (data.name || "K").charAt(0).toUpperCase();

    var initialEl = qs("[data-profile-initial]", page);
    var nameEl = qs("[data-profile-name]", page);
    var emailEl = qs("[data-profile-email]", page);
    var inputNameEl = qs("[data-profile-input-name]", page);
    var inputSurnameEl = qs("[data-profile-input-surname]", page);
    var inputEmailEl = qs("[data-profile-input-email]", page);

    console.log("[profile.section] applyProfile:nodes", {
      initialEl: !!initialEl,
      nameEl: !!nameEl,
      emailEl: !!emailEl,
      inputNameEl: !!inputNameEl,
      inputSurnameEl: !!inputSurnameEl,
      inputEmailEl: !!inputEmailEl
    });

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

    console.log("[profile.section] applyProfile:done", {
      renderedName: nameEl ? nameEl.textContent : null,
      renderedEmail: emailEl ? emailEl.textContent : null,
      inputName: inputNameEl ? inputNameEl.value : null,
      inputSurname: inputSurnameEl ? inputSurnameEl.value : null,
      inputEmail: inputEmailEl ? inputEmailEl.value : null
    });
  }

  async function hydrateProfileFromApi() {
    var page = getProfilePage();
    if (!page) return;

    try {
      var res = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store"
      });

      if (!res.ok) return;

      var me = await res.json();
      if (!me) return;

      var email = firstNonEmpty(
        me.email,
        me.user && me.user.email,
        ""
      );

      var firstName = firstNonEmpty(
        me.first_name,
        me.firstName,
        me.name,
        me.full_name,
        me.fullName,
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

      if (!email && !firstName && !lastName) return;

         var emailName = "";
      if (email && String(email).indexOf("@") !== -1) {
        emailName = String(email).split("@")[0].trim();
      }

      var resolvedName = firstNonEmpty(
        firstName,
        emailName,
        "Kullanıcı"
      );

      var resolvedSurname = firstNonEmpty(
        lastName,
        ""
      );

      var resolvedFullName = firstNonEmpty(
        (resolvedName && resolvedSurname) ? (resolvedName + " " + resolvedSurname) : "",
        resolvedName,
        "Kullanıcı"
      );

      safeSetLS("aivo_auth_unified_v1", JSON.stringify({
        loggedIn: true,
        email: email || "",
        name: resolvedName,
        full_name: resolvedFullName,
        first_name: resolvedName,
        last_name: resolvedSurname,
        surname: resolvedSurname,
        ts: Date.now()
      }));

      safeSetLS("aivo_profile_name", resolvedName);
      safeSetLS("aivo_profile_surname", resolvedSurname);

      var initial = resolvedFullName.charAt(0).toUpperCase();

      value(qs("[data-profile-input-name]", page), firstName || "");
      value(qs("[data-profile-input-surname]", page), lastName || "");
      value(qs("[data-profile-input-email]", page), email || "");

      text(qs("[data-profile-name]", page), resolvedFullName);
      text(qs("[data-profile-email]", page), email || "—");
      text(qs("[data-profile-initial]", page), initial);

      document.dispatchEvent(new CustomEvent("aivo:profile-saved", {
        detail: {
          name: firstName || "",
          surname: lastName || "",
          fullName: resolvedFullName,
          email: email || ""
        }
      }));
    } catch (err) {
      console.warn("[profile.section] hydrateProfileFromApi failed", err);
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

      var email = firstNonEmpty(
        readJSON("aivo_auth_unified_v1").email,
        qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value,
        qs("[data-profile-email]", page) && qs("[data-profile-email]", page).textContent,
        "—"
      );

      if (!name) {
        if (window.toast && window.toast.error) window.toast.error("Ad alanı boş olamaz.");
        return;
      }

      safeSetLS("aivo_profile_name", name);
      safeSetLS("aivo_profile_surname", surname);

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

      var fullName = surname ? (name + " " + surname).trim() : name;

      text(qs("[data-profile-name]", page), fullName);
      text(qs("[data-profile-email]", page), firstNonEmpty(auth.email, email, "—"));
      text(qs("[data-profile-initial]", page), fullName.charAt(0).toUpperCase());

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
async function renderProfileNow() {
  var page = getProfilePage();
  if (!page) return false;

  bindSave();

  var shouldHydrateFromApi = false;
  var now = Date.now();
  var auth = readJSON("aivo_auth_unified_v1");

  var pageEmailNow = firstNonEmpty(
    qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value,
    qs("[data-profile-email]", page) && qs("[data-profile-email]", page).textContent,
    ""
  ).toLowerCase();

  var cachedAuthEmail = firstNonEmpty(auth.email).toLowerCase();

  if (pageEmailNow && cachedAuthEmail && pageEmailNow !== cachedAuthEmail) {
    safeSetLS("aivo_profile_name", "");
    safeSetLS("aivo_profile_surname", "");
    safeSetLS("aivo_auth_unified_v1", JSON.stringify({
      loggedIn: true,
      email: pageEmailNow,
      name: "",
      full_name: "",
      first_name: "",
      last_name: "",
      surname: "",
      ts: 0
    }));
    window.__aivoProfileHydrateAt = 0;
    auth = readJSON("aivo_auth_unified_v1");
  }

  var hasCachedEmail = !!firstNonEmpty(auth.email);
  var hasCachedName = !!firstNonEmpty(
    auth.full_name,
    auth.name,
    auth.first_name
  );

  var lastHydrateAt = Number(window.__aivoProfileHydrateAt || 0);
  var hydrateInFlight = !!window.__aivoProfileHydrateInFlight;

  if (isProfileActive()) {
    if ((!hasCachedEmail || !hasCachedName) && !hydrateInFlight) {
      shouldHydrateFromApi = true;
    } else if ((now - lastHydrateAt) > 15000 && !hydrateInFlight) {
      shouldHydrateFromApi = true;
    }
  }

  if (shouldHydrateFromApi) {
    try {
      window.__aivoProfileHydrateInFlight = true;
      await hydrateProfileFromApi();
      window.__aivoProfileHydrateAt = Date.now();
      auth = readJSON("aivo_auth_unified_v1");
    } finally {
      window.__aivoProfileHydrateInFlight = false;
    }
  }

  if (isProfileActive()) {
    applyProfile();
  } else {
    var initialEl = qs("[data-profile-initial]", page);
    var nameEl = qs("[data-profile-name]", page);
    var emailEl = qs("[data-profile-email]", page);

    var email = firstNonEmpty(
      qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value,
      auth.email,
      ""
    );

    var name = firstNonEmpty(
      qs("[data-profile-name]", page) && qs("[data-profile-name]", page).textContent,
      auth.full_name,
      auth.name,
      auth.first_name,
      ""
    );

    if (email) {
      value(qs("[data-profile-input-email]", page), email);
      text(emailEl, email);
    }

    if (name) {
      text(nameEl, name);
      text(initialEl, name.charAt(0).toUpperCase());
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
