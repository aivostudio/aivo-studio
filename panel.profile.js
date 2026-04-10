// /panel.profile.js
(function () {
  "use strict";

  const KEY = "profile";

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch (e) {
      return {};
    }
  }

  function firstNonEmpty() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
  }

  function getText(sel, root) {
    const node = qs(sel, root);
    return node ? String(node.textContent || "").trim() : "";
  }

  function getValue(sel, root) {
    const node = qs(sel, root);
    return node ? String(node.value || "").trim() : "";
  }

  function readAuth() {
    return readJSON("aivo_auth_unified_v1");
  }

  function getProfilePage() {
    const pages = qsa('.page-profile[data-page="profile"]');

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page && page.isConnected && page.offsetParent !== null) return page;
    }

    const fallbackPages = qsa('[data-page="profile"]');

    for (let j = 0; j < fallbackPages.length; j++) {
      const fallbackPage = fallbackPages[j];
      if (fallbackPage && fallbackPage.isConnected && fallbackPage.offsetParent !== null) {
        return fallbackPage;
      }
    }

    return null;
  }

  function readProfileState(ctx) {
    const page = getProfilePage();
    const auth = readAuth();

    const normalizeEmail = function (v) {
      return String(v || "").trim().toLowerCase();
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
      activeEmail && activeEmail !== "—" && activeEmail.indexOf("@") !== -1
        ? String(activeEmail).split("@")[0].trim()
        : "";

    const finalEmail = activeEmail;

    const baseName = firstNonEmpty(
      pageName,
      ctxName,
      activeEmailName,
      auth.full_name,
      auth.name,
      auth.first_name,
      authEmailName,
      "Kullanıcı"
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
        getText('[data-stat="totalCredits"]', page),
        safeCtx.credits,
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
      email: finalEmail,
      credits: credits,
      spentCredits: spentCredits
    };
  }

  function buildCard(state) {
    const root = el(`
      <div class="rp-card">
        <div class="rp-card__header">
          <div class="rp-title">Profil</div>
          <div class="rp-subtitle">Hesap özeti</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">Hesap</div>

            <div class="rp-row">
              <div class="rp-row__label">Kullanıcı</div>
              <div class="rp-row__value" data-val="name">—</div>
            </div>

            <div class="rp-row">
              <div class="rp-row__label">E-posta</div>
              <div class="rp-row__value" data-val="email">—</div>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Krediler</div>

            <div class="rp-metric-grid">
              <div class="rp-metric">
                <div class="rp-metric__label">Toplam</div>
                <div class="rp-metric__value" data-val="credits">—</div>
              </div>

              <div class="rp-metric">
                <div class="rp-metric__label">Harcanan</div>
                <div class="rp-metric__value" data-val="spent">—</div>
              </div>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Kısayollar</div>

            <div class="rp-actions">
              <button class="rp-btn" type="button" data-act="buy-credits">Kredi Satın Al</button>
              <button class="rp-btn rp-btn--ghost" type="button" data-act="go-library">Ürettiklerim</button>
            </div>
          </div>

          <div class="rp-hint">
            Profil özeti ve hızlı erişim bu panelde gösterilir.
          </div>
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
    const state = readProfileState(ctx);
    const root = buildCard(state);

    function onClick(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;

      const act = btn.getAttribute("data-act");

      if (act === "buy-credits") {
        window.location.href = "/fiyatlandirma.html#packs";
        return;
      }

      if (act === "go-library") {
        if (window.StudioRouter && typeof window.StudioRouter.setHash === "function") {
          window.StudioRouter.setHash("library");
          return;
        }
        window.location.hash = "#library";
      }
    }

    root.addEventListener("click", onClick);
    root._cleanup = function () {
      root.removeEventListener("click", onClick);
    };

    const oldRoot = host.firstElementChild;
    if (oldRoot && oldRoot._cleanup) oldRoot._cleanup();

    host.innerHTML = "";
    host.appendChild(root);
  }

  function mount(host, ctx = {}) {
    host.innerHTML = "";
    render(host, ctx);

    let profileObserver = null;

    function rerenderSoon(delay) {
      window.setTimeout(function () {
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

    function onStorage(e) {
      if (!e) return;

      if (
        e.key === "aivo_profile_name" ||
        e.key === "aivo_profile_surname" ||
        e.key === "aivo_auth_unified_v1"
      ) {
        rerenderSoon(0);
        rerenderSoon(120);
        rerenderSoon(300);
      }
    }

    function onDocumentClick(e) {
      const saveBtn = e.target && e.target.closest
        ? e.target.closest("[data-profile-save]")
        : null;

      if (!saveBtn) return;

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

    window.addEventListener("storage", onStorage);
    document.addEventListener("click", onDocumentClick, true);
    document.addEventListener("aivo:profile-saved", onProfileSaved);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("hashchange", onRouteOrDomChange);

    const bodyObserver = new MutationObserver(function () {
      bindProfileObserver();
      rerenderSoon(0);
    });

    bodyObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-active-page", "class", "style"]
    });

    bindProfileObserver();
    rerenderSoon(0);
    rerenderSoon(120);
    rerenderSoon(300);
    rerenderSoon(600);

    host._cleanup = function () {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("click", onDocumentClick, true);
      document.removeEventListener("aivo:profile-saved", onProfileSaved);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("hashchange", onRouteOrDomChange);

      if (profileObserver) {
        profileObserver.disconnect();
        profileObserver = null;
      }

      if (bodyObserver) {
        bodyObserver.disconnect();
      }

      const root = host.firstElementChild;
      if (root && root._cleanup) root._cleanup();
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

    const root = host && host.firstElementChild;
    if (root && root._cleanup) root._cleanup();

    if (host) host.innerHTML = "";
  }

  if (!window.RightPanel || typeof window.RightPanel.register !== "function") {
    console.warn("[panel.profile] RightPanel not ready; register skipped");
    return;
  }

  window.RightPanel.register(KEY, { mount, destroy });
})();
