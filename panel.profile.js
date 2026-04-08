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

  function firstNonEmpty() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
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

  function readAuth() {
    return readJSON("aivo_auth_unified_v1");
  }

  function readCreditsFromTopbar() {
    return getText("#topCreditCount") || "";
  }

  function readSpentCreditsFromProfilePage(page) {
    const node = page ? qs('[data-stat="spentCredits"]', page) : null;
    return node ? String(node.textContent || "").trim() : "";
  }

function getProfilePage() {
  return (
    qs('.page-profile[data-page="profile"]') ||
    qs('[data-page="profile"]') ||
    qs(".main-panel")
  );
}

function readSpentCreditsFromProfilePage(page) {
  const scopedNode = page ? qs('[data-stat="spentCredits"]', page) : null;
  if (scopedNode) {
    return String(scopedNode.textContent || "").trim();
  }

  const globalNode = qs('[data-stat="spentCredits"]');
  if (globalNode) {
    return String(globalNode.textContent || "").trim();
  }

  const rows = Array.prototype.slice.call(
    document.querySelectorAll(".usage-row, .rp-row, .stat-row, .usage-pill")
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const txt = String(row.textContent || "").toLowerCase();

    if (txt.indexOf("harcanan kredi") !== -1) {
      const valNode =
        row.querySelector(".usage-value") ||
        row.querySelector('[data-stat="spentCredits"]') ||
        row.querySelector(".rp-row__value") ||
        row.querySelector(".stat-value");

      if (valNode) return String(valNode.textContent || "").trim();

      const match = String(row.textContent || "").match(/(\d[\d.]*)/);
      if (match && match[1]) return match[1];
    }
  }

  return "";
}

function readProfileState(ctx) {
  const page = getProfilePage();
  const auth = readAuth();

  const savedName = safeGetLS("aivo_profile_name") || "";
  const savedSurname = safeGetLS("aivo_profile_surname") || "";

  const inputName = firstNonEmpty(
    getValue("[data-profile-input-name]", page),
    getValue("[data-profile-input-name]"),
    getText("[data-profile-name]", page),
    getText("[data-profile-name]")
  );

  const inputSurname = firstNonEmpty(
    getValue("[data-profile-input-surname]", page),
    getValue("[data-profile-input-surname]"),
    savedSurname,
    auth.surname,
    auth.last_name,
    auth.lastName,
    ctx && ctx.surname
  );

  const authFullName = firstNonEmpty(
    auth.name,
    auth.full_name,
    auth.fullName,
    auth.username
  );

  let finalName = firstNonEmpty(
    inputName,
    savedName,
    authFullName,
    ctx && ctx.name,
    "Kullanıcı"
  );

  if (
    inputSurname &&
    finalName &&
    finalName.toLowerCase().indexOf(inputSurname.toLowerCase()) === -1
  ) {
    finalName = (finalName + " " + inputSurname).trim();
  }

  const email = firstNonEmpty(
    getValue("[data-profile-input-email]", page),
    getValue("[data-profile-input-email]"),
    getText("[data-profile-email]", page),
    getText("[data-profile-email]"),
    auth.email,
    ctx && ctx.email,
    "—"
  );

  const credits = firstNonEmpty(
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
    name: finalName,
    email: email,
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

    function rerenderSoon() {
      window.setTimeout(function () {
        if (!host || !document.body.contains(host)) return;
        render(host, ctx);
      }, 0);
    }

    function onStorage(e) {
      if (!e) return;

      if (
        e.key === "aivo_profile_name" ||
        e.key === "aivo_auth_unified_v1"
      ) {
        rerenderSoon();
      }
    }

    function onDocumentClick(e) {
      const saveBtn = e.target && e.target.closest
        ? e.target.closest("[data-profile-save]")
        : null;

      if (!saveBtn) return;

      rerenderSoon();
      window.setTimeout(rerenderSoon, 120);
      window.setTimeout(rerenderSoon, 300);
    }

    function onProfileSaved() {
      rerenderSoon();
    }

    function onVisibilityChange() {
      if (!document.hidden) rerenderSoon();
    }

    window.addEventListener("storage", onStorage);
    document.addEventListener("click", onDocumentClick, true);
    document.addEventListener("aivo:profile-saved", onProfileSaved);
    document.addEventListener("visibilitychange", onVisibilityChange);

    host._cleanup = function () {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("click", onDocumentClick, true);
      document.removeEventListener("aivo:profile-saved", onProfileSaved);
      document.removeEventListener("visibilitychange", onVisibilityChange);

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
