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
      if (page && page.isConnected && page.offsetParent !== null) return page;
    }

    var fallbackPages = qsa('[data-page="profile"]');
    for (var j = 0; j < fallbackPages.length; j++) {
      var fallbackPage = fallbackPages[j];
      if (fallbackPage && fallbackPage.isConnected && fallbackPage.offsetParent !== null) return fallbackPage;
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
    var node = qs("#topCreditCount");
    return node ? String(node.textContent || "").trim() : "";
  }

  function readSpentCreditsFromProfilePage(page) {
    var scopedNode = page ? qs('[data-stat="spentCredits"]', page) : null;
    if (scopedNode) return String(scopedNode.textContent || "").trim();

    var globalNode = qs('[data-stat="spentCredits"]');
    if (globalNode) return String(globalNode.textContent || "").trim();

    var rows = Array.prototype.slice.call(
      document.querySelectorAll(".usage-row, .rp-row, .stat-row, .usage-pill")
    );

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var txt = String(row.textContent || "").toLowerCase();

      if (txt.indexOf("harcanan kredi") !== -1) {
        var valNode =
          row.querySelector(".usage-value") ||
          row.querySelector('[data-stat="spentCredits"]') ||
          row.querySelector(".rp-row__value") ||
          row.querySelector(".stat-value");

        if (valNode) return String(valNode.textContent || "").trim();

        var match = String(row.textContent || "").match(/(\d[\d.]*)/);
        if (match && match[1]) return match[1];
      }
    }

    return "";
  }

  function readProfileData() {
    var page = getProfilePage();
    if (!page) return null;

    var auth = readJSON("aivo_auth_unified_v1");

    var cachedName = (safeGetLS("aivo_profile_name") || "").trim();
    var cachedSurname = (safeGetLS("aivo_profile_surname") || "").trim();

    var name = firstNonEmpty(
      qs("[data-profile-input-name]", page) && qs("[data-profile-input-name]", page).value,
      cachedName,
      auth.first_name,
      auth.name,
      auth.full_name,
      auth.fullName,
      auth.username,
      qs("[data-profile-name]", page) && qs("[data-profile-name]", page).textContent
    );

    var surname = firstNonEmpty(
      qs("[data-profile-input-surname]", page) && qs("[data-profile-input-surname]", page).value,
      cachedSurname,
      auth.surname,
      auth.last_name,
      auth.lastName
    );

    var fullName = name || "Kullanıcı";
    if (surname && fullName.toLowerCase().indexOf(surname.toLowerCase()) === -1) {
      fullName = (fullName + " " + surname).trim();
    }

    var email = firstNonEmpty(
      auth.email,
      qs("[data-profile-input-email]", page) && qs("[data-profile-input-email]", page).value,
      qs("[data-profile-email]", page) && qs("[data-profile-email]", page).textContent,
      "—"
    );

    var planText = firstNonEmpty(
      qs("[data-profile-plan]", page) && qs("[data-profile-plan]", page).textContent,
      qs("#umPlan") && qs("#umPlan").textContent,
      "Basic"
    );

    var creditText = firstNonEmpty(
      qs("[data-profile-credit]", page) && qs("[data-profile-credit]", page).textContent,
      readCreditsFromTopbar(),
      "0"
    );

    var spentText = firstNonEmpty(
      readSpentCreditsFromProfilePage(page),
      "0"
    );

    var plan = "Basic";
    var credit = "0";

    if (planText) {
      var pm = String(planText).match(/Plan:\s*(.+)$/i);
      if (pm && pm[1]) plan = pm[1].trim();
      else plan = String(planText).trim();
    }

    if (creditText) {
      var cm = String(creditText).match(/(\d+)/);
      if (cm && cm[1]) credit = cm[1];
    }

    return {
      name: fullName,
      surname: surname,
      email: email,
      plan: plan,
      credit: credit,
      spent: spentText
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

      safeSetLS("aivo_auth_unified_v1", JSON.stringify({
        loggedIn: true,
        email: email || "",
        name: firstNonEmpty(firstName, ""),
        full_name: firstNonEmpty(
          (firstName && lastName) ? (firstName + " " + lastName) : "",
          firstName,
          ""
        ),
        first_name: firstNonEmpty(firstName, ""),
        last_name: firstNonEmpty(lastName, ""),
        surname: firstNonEmpty(lastName, ""),
        ts: Date.now()
      }));

      if (firstName) safeSetLS("aivo_profile_name", firstName);
      if (lastName) safeSetLS("aivo_profile_surname", lastName);

          var cachedName = firstNonEmpty(
        safeGetLS("aivo_profile_name"),
        readJSON("aivo_auth_unified_v1").first_name,
        readJSON("aivo_auth_unified_v1").name,
        ""
      );

      var emailName = "";
      if (email && String(email).indexOf("@") !== -1) {
        emailName = String(email).split("@")[0].trim();
      }

      var fullName = firstNonEmpty(
        (firstName && lastName) ? (firstName + " " + lastName) : "",
        firstName,
        cachedName,
        emailName,
        "Kullanıcı"
      );

      var initial = fullName.charAt(0).toUpperCase();

      value(qs("[data-profile-input-name]", page), firstName || "");
      value(qs("[data-profile-input-surname]", page), lastName || "");
      value(qs("[data-profile-input-email]", page), email || "");

      text(qs("[data-profile-name]", page), fullName);
      text(qs("[data-profile-email]", page), email || "—");
      text(qs("[data-profile-initial]", page), initial);

      document.dispatchEvent(new CustomEvent("aivo:profile-saved", {
        detail: {
          name: firstName || "",
          surname: lastName || "",
          fullName: fullName,
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

  function observePage() {
    if (window.__aivoProfileSectionObserverBound) return;
    window.__aivoProfileSectionObserverBound = true;

    var mo = new MutationObserver(async function () {
      if (isProfileActive()) {
        await hydrateProfileFromApi();
        applyProfile();
        bindSave();
      }
    });

    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-active-page"]
    });
  }
    document.addEventListener("DOMContentLoaded", async function () {
    await hydrateProfileFromApi();
    bindSave();
    observePage();
    applyProfile();

    setTimeout(async function () {
      await hydrateProfileFromApi();
      bindSave();
      applyProfile();
    }, 300);
  });
})();
