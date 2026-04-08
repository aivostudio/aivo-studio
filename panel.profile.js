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

  function safeGetLS(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch (e) {
      return {};
    }
  }

  function readAuth() {
    return readJSON("aivo_auth_unified_v1");
  }

  function getProfilePage() {
    return qs('.page-profile[data-page="profile"]');
  }

  function getText(sel, root) {
    const node = qs(sel, root);
    return node ? String(node.textContent || "").trim() : "";
  }

  function getValue(sel, root) {
    const node = qs(sel, root);
    return node ? String(node.value || "").trim() : "";
  }

  function firstNonEmpty() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
  }

  function readCreditsFromTopbar() {
    const topCredit = getText("#topCreditCount");
    return topCredit || "";
  }

  function readSpentCreditsFromProfilePage(page) {
    if (!page) return "";

    const spentNode = qsa("[data-stat]", page).find(function (node) {
      return node.getAttribute("data-stat") === "spentCredits";
    });

    if (!spentNode) return "";

    return String(spentNode.textContent || "").trim();
  }

  function readProfileState(ctx) {
    const page = getProfilePage();
    const auth = readAuth();

    const savedName = safeGetLS("aivo_profile_name") || "";

    const pageName = firstNonEmpty(
      getValue("[data-profile-input-name]", page),
      getText("[data-profile-name]", page)
    );

    const pageSurname = firstNonEmpty(
      getValue("[data-profile-input-surname]", page)
    );

    const authName = firstNonEmpty(
      auth.name,
      auth.full_name,
      auth.fullName,
      auth.username
    );

    const name = firstNonEmpty(
      pageName,
      savedName,
      authName,
      ctx && ctx.name,
      "Kullanıcı"
    );

    const surname = firstNonEmpty(
      pageSurname,
      ctx && ctx.surname
    );

    const email = firstNonEmpty(
      getValue("[data-profile-input-email]", page),
      getText("[data-profile-email]", page),
      auth.email,
      ctx && ctx.email,
      "—"
    );

    const totalCredits = firstNonEmpty(
      ctx && ctx.credits,
      readCreditsFromTopbar(),
      "0"
    );

    const spentCredits = firstNonEmpty(
      ctx && ctx.spentCredits,
      readSpentCreditsFromProfilePage(page),
      "0"
    );

    return {
      name: surname ? (name + " " + surname).trim() : name,
      email: email,
      credits: totalCredits,
      spentCredits: spentCredits
    };
  }

  function render(host, ctx) {
    const state = readProfileState(ctx);

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

    host.innerHTML = "";
    host.appendChild(root);
  }

  function mount(host, ctx = {}) {
    host.innerHTML = "";
    render(host, ctx);

    const rerender = function () {
      if (!host || !document.body.contains(host)) return;
      render(host, ctx);
    };

    const onStorage = function (e) {
      if (!e) return;

      if (
        e.key === "aivo_profile_name" ||
        e.key === "aivo_auth_unified_v1"
      ) {
        rerender();
      }
    };

    const onProfileSaved = function () {
      rerender();
    };

    const mo = new MutationObserver(function () {
      rerender();
    });

    window.addEventListener("storage", onStorage);
    document.addEventListener("aivo:profile-saved", onProfileSaved);
    mo.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true
    });

    host._cleanup = function () {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("aivo:profile-saved", onProfileSaved);
      mo.disconnect();

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
