// /panel.profile.js
(function () {
  "use strict";

  const KEY = "profile";

  function currentLanguage() {
    const raw = String(
      window.AIVO_LANG ||
      document.documentElement.lang ||
      "tr"
    ).trim().toLowerCase();

    return raw.indexOf("en") === 0 ? "en" : "tr";
  }

  function formatFallback(value, parameters) {
    let output = String(value == null ? "" : value);

    if (!parameters || typeof parameters !== "object") {
      return output;
    }

    Object.keys(parameters).forEach(function (key) {
      output = output.replace(
        new RegExp("\\{" + key + "\\}", "g"),
        String(parameters[key])
      );
    });

    return output;
  }

  function profileText(key, trFallback, enFallback, parameters) {
    const fallback = currentLanguage() === "en" ? enFallback : trFallback;

    try {
      if (
        window.AIVO_STUDIO_I18N &&
        typeof window.AIVO_STUDIO_I18N.translate === "function"
      ) {
        const translated = window.AIVO_STUDIO_I18N.translate(
          key,
          fallback,
          parameters
        );

        if (translated && translated !== key) {
          return translated;
        }
      }

      if (typeof window.t === "function") {
        const translated = window.t(key, parameters);

        if (translated && translated !== key) {
          return translated;
        }
      }
    } catch (_) {}

    return formatFallback(fallback, parameters);
  }

  function el(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(selector)
    );
  }

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch (_) {
      return {};
    }
  }

  function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];

      if (value != null && String(value).trim()) {
        return String(value).trim();
      }
    }

    return "";
  }

  function getText(selector, root) {
    const node = qs(selector, root);
    return node ? String(node.textContent || "").trim() : "";
  }

  function getValue(selector, root) {
    const node = qs(selector, root);
    return node ? String(node.value || "").trim() : "";
  }

  function readAuth() {
    return readJSON("aivo_auth_unified_v1");
  }

  function getProfilePage() {
    const pages = qsa('.page-profile[data-page="profile"]');

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];

      if (page && page.isConnected && page.offsetParent !== null) {
        return page;
      }
    }

    const fallbackPages = qsa('[data-page="profile"]');

    for (let index = 0; index < fallbackPages.length; index += 1) {
      const page = fallbackPages[index];

      if (page && page.isConnected && page.offsetParent !== null) {
        return page;
      }
    }

    return null;
  }

  function readProfileState(ctx) {
    const page = getProfilePage();
    const auth = readAuth();

    const normalizeEmail = function (value) {
      return String(value || "").trim().toLowerCase();
    };

    const authEmail = normalizeEmail(firstNonEmpty(auth.email, ""));
    const pageEmail = normalizeEmail(firstNonEmpty(
      getValue("[data-profile-input-email]", page),
      getText("[data-profile-email]", page)
    ));
    const ctxEmail = normalizeEmail(firstNonEmpty(ctx && ctx.email, ""));

    const activeEmail = firstNonEmpty(
      pageEmail,
      authEmail,
      "—"
    );

    const ctxMatchesActive =
      !!ctxEmail &&
      !!activeEmail &&
      activeEmail !== "—" &&
      ctxEmail === activeEmail;

    const safeCtx = ctxMatchesActive ? (ctx || {}) : {};

    const pageName = firstNonEmpty(
      getText("[data-profile-name]", page)
    );

    const pageSurname = firstNonEmpty(
      getValue("[data-profile-input-surname]", page)
    );

    const ctxName = firstNonEmpty(
      safeCtx.fullName,
      safeCtx.name
    );

    const ctxSurname = firstNonEmpty(
      safeCtx.surname
    );

    const authEmailName =
      authEmail && authEmail.indexOf("@") !== -1
        ? String(authEmail).split("@")[0].trim()
        : "";

    const activeEmailName =
      activeEmail &&
      activeEmail !== "—" &&
      activeEmail.indexOf("@") !== -1
        ? String(activeEmail).split("@")[0].trim()
        : "";

    const userFallback = profileText(
      "studio.profile.userFallback",
      "Kullanıcı",
      "User"
    );

    const baseName = firstNonEmpty(
      pageName,
      ctxName,
      activeEmailName,
      auth.full_name,
      auth.name,
      auth.first_name,
      authEmailName,
      userFallback
    );

    const finalSurname = firstNonEmpty(
      pageSurname,
      ctxSurname,
      auth.surname,
      auth.last_name,
      auth.lastName,
      ""
    );

    let finalName = baseName;

    if (
      finalSurname &&
      finalName &&
      finalName.toLowerCase().indexOf(finalSurname.toLowerCase()) === -1
    ) {
      finalName = (finalName + " " + finalSurname).trim();
    }

    const credits = String(
      firstNonEmpty(
        getText("#topCreditCount"),
        getText('[data-stat="totalCredits"]', page),
        ctx && ctx.credits,
        "0"
      )
    );

    const spentCredits = String(
      firstNonEmpty(
        getText('[data-stat="spentCredits"]', page),
        safeCtx.spentCredits,
        "0"
      )
    );

    return {
      name: finalName,
      email: activeEmail,
      credits: credits,
      spentCredits: spentCredits
    };
  }

  function buildCard(state) {
    const root = el(`
      <div class="rp-card">
        <div class="rp-card__header">
          <div class="rp-title">${profileText(
            "studio.profile.panel.title",
            "Profil",
            "Profile"
          )}</div>
          <div class="rp-subtitle">${profileText(
            "studio.profile.panel.subtitle",
            "Hesap özeti",
            "Account summary"
          )}</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">${profileText(
              "studio.profile.panel.account",
              "Hesap",
              "Account"
            )}</div>

            <div class="rp-row">
              <div class="rp-row__label">${profileText(
                "studio.profile.panel.user",
                "Kullanıcı",
                "User"
              )}</div>
              <div class="rp-row__value" data-val="name">—</div>
            </div>

            <div class="rp-row">
              <div class="rp-row__label">${profileText(
                "studio.profile.panel.email",
                "E-posta",
                "Email"
              )}</div>
              <div class="rp-row__value" data-val="email">—</div>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">${profileText(
              "studio.profile.panel.credits",
              "Krediler",
              "Credits"
            )}</div>

            <div class="rp-metric-grid">
              <div class="rp-metric">
                <div class="rp-metric__label">${profileText(
                  "studio.profile.panel.total",
                  "Toplam",
                  "Total"
                )}</div>
                <div class="rp-metric__value" data-val="credits">—</div>
              </div>

              <div class="rp-metric">
                <div class="rp-metric__label">${profileText(
                  "studio.profile.panel.spent",
                  "Harcanan",
                  "Spent"
                )}</div>
                <div class="rp-metric__value" data-val="spent">—</div>
              </div>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">${profileText(
              "studio.profile.panel.shortcuts",
              "Kısayollar",
              "Shortcuts"
            )}</div>

            <div class="rp-actions">
              <a
                class="rp-btn"
                href="/fiyatlandirma.html#packs"
              >${profileText(
                "studio.profile.panel.buyCredits",
                "Kredi Satın Al",
                "Buy Credits"
              )}</a>
            </div>
          </div>

          <div class="rp-hint">${profileText(
            "studio.profile.panel.hint",
            "Profil özeti ve hızlı erişim bu panelde gösterilir.",
            "Your profile summary and quick access options are shown in this panel."
          )}</div>
        </div>
      </div>
    `);

    root.querySelector('[data-val="name"]').textContent = state.name;
    root.querySelector('[data-val="email"]').textContent = state.email;
    root.querySelector('[data-val="credits"]').textContent = state.credits;
    root.querySelector('[data-val="spent"]').textContent = state.spentCredits;

    return root;
  }

  function render(host, ctx) {
    if (!host) return;

    const state = readProfileState(ctx);
    const root = buildCard(state);

    host.replaceChildren(root);
  }

  function mount(host, ctx = {}) {
    let destroyed = false;
    let profileObserver = null;

    function rerenderSoon(delay) {
      window.setTimeout(function () {
        if (destroyed) return;
        if (!host || !document.body.contains(host)) return;
        render(host, ctx);
      }, Number(delay || 0));
    }

    function bindProfileObserver() {
      if (profileObserver) {
        profileObserver.disconnect();
        profileObserver = null;
      }

      const page = getProfilePage();
      if (!page) return;

      profileObserver = new MutationObserver(function () {
        rerenderSoon(0);
      });

      profileObserver.observe(page, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["value", "class", "style"]
      });
    }

    function onStorage(event) {
      if (!event) return;

      if (
        event.key === "aivo_profile_name" ||
        event.key === "aivo_profile_surname" ||
        event.key === "aivo_auth_unified_v1"
      ) {
        rerenderSoon(0);
        rerenderSoon(120);
        rerenderSoon(300);
      }
    }

    function onDocumentClick(event) {
      const saveButton =
        event.target && event.target.closest
          ? event.target.closest("[data-profile-save]")
          : null;

      if (!saveButton) return;

      rerenderSoon(0);
      rerenderSoon(120);
      rerenderSoon(300);
    }

    function onProfileSaved() {
      rerenderSoon(0);
      rerenderSoon(120);
      rerenderSoon(300);
    }

    function onVisibilityChange() {
      if (!document.hidden) {
        bindProfileObserver();
        rerenderSoon(0);
        rerenderSoon(120);
      }
    }

    function onRouteOrDomChange() {
      bindProfileObserver();
      rerenderSoon(0);
    }

    function onLanguageChange() {
      rerenderSoon(0);
    }

    const bodyObserver = new MutationObserver(function () {
      bindProfileObserver();
      rerenderSoon(0);
    });

    window.addEventListener("storage", onStorage);
    document.addEventListener("click", onDocumentClick, true);
    document.addEventListener("aivo:profile-saved", onProfileSaved);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("hashchange", onRouteOrDomChange);
    window.addEventListener("aivo:languagechange", onLanguageChange);
    window.addEventListener("aivo:i18n:changed", onLanguageChange);

    bodyObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-active-page", "class", "style"]
    });

    render(host, ctx);
    bindProfileObserver();
    rerenderSoon(120);
    rerenderSoon(300);
    rerenderSoon(600);

    host._cleanup = function () {
      destroyed = true;

      window.removeEventListener("storage", onStorage);
      document.removeEventListener("click", onDocumentClick, true);
      document.removeEventListener("aivo:profile-saved", onProfileSaved);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("hashchange", onRouteOrDomChange);
      window.removeEventListener("aivo:languagechange", onLanguageChange);
      window.removeEventListener("aivo:i18n:changed", onLanguageChange);

      if (profileObserver) {
        profileObserver.disconnect();
        profileObserver = null;
      }

      bodyObserver.disconnect();
    };

    return function unmount() {
      destroy(host);
    };
  }

  function destroy(host) {
    if (host && host._cleanup) {
      host._cleanup();
      host._cleanup = null;
    }

    if (host) {
      host.innerHTML = "";
    }
  }

  if (!window.RightPanel || typeof window.RightPanel.register !== "function") {
    console.warn("[panel.profile] RightPanel not ready; register skipped");
    return;
  }

  window.RightPanel.register(KEY, {
    header: {
      title: profileText(
        "studio.profile.panel.title",
        "Profil",
        "Profile"
      ),
      meta: profileText(
        "studio.profile.panel.subtitle",
        "Hesap özeti",
        "Account summary"
      ),
      searchEnabled: false,
      resetSearch: true
    },
    mount,
    destroy
  });
})();
