/* =========================================================
   AIVO — CHILD CARTOON UI
   - cartoon route için orta panel UI
   - Şimdilik sadece arayüz iskeleti
   - Fal yok
   - DB yok
   ========================================================= */

(function AIVO_CHILD_CARTOON_UI() {
  "use strict";

  if (window.__AIVO_CHILD_CARTOON_UI__) return;
  window.__AIVO_CHILD_CARTOON_UI__ = true;

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getHost() {
    return document.getElementById("moduleHost");
  }

  function isCartoonRoute() {
    const hash = String(location.hash || "").toLowerCase();
    const search = String(location.search || "").toLowerCase();
    return hash.includes("#cartoon") || search.includes("page=cartoon") || search.includes("to=cartoon");
  }

  function setActiveChoice(group, value) {
    const root = document.querySelector('.ccf-group[data-group="' + group + '"]');
    if (!root) return;

    root.querySelectorAll("[data-choice]").forEach((btn) => {
      const on = btn.getAttribute("data-choice") === value;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function toggleMultiChoice(group, value) {
    const root = document.querySelector('.ccf-group[data-group="' + group + '"]');
    if (!root) return;

    const btn = root.querySelector('[data-choice="' + value + '"]');
    if (!btn) return;

    const next = !btn.classList.contains("is-active");
    btn.classList.toggle("is-active", next);
    btn.setAttribute("aria-pressed", next ? "true" : "false");
  }

  function collectState() {
    const getSingle = (group) => {
      const el = document.querySelector('.ccf-group[data-group="' + group + '"] [data-choice].is-active');
      return el ? (el.getAttribute("data-choice") || "") : "";
    };

    const getMulti = (group) => {
      return Array.from(
        document.querySelectorAll('.ccf-group[data-group="' + group + '"] [data-choice].is-active')
      ).map((el) => el.getAttribute("data-choice"));
    };

    const extraPrompt = document.getElementById("ccfExtraPrompt")?.value?.trim() || "";

    return {
      mainCharacter: getSingle("main-character"),
      helperCharacters: getMulti("helper-characters"),
      scene: getSingle("scene"),
      action: getSingle("action"),
      style: getSingle("style"),
      duration: getSingle("duration"),
      extraPrompt
    };
  }

  function renderSummary() {
    const box = document.getElementById("ccfSummary");
    if (!box) return;

    const s = collectState();

    box.innerHTML = `
      <div class="ccf-summary-row"><strong>Ana Karakter:</strong> ${escapeHtml(s.mainCharacter || "-")}</div>
      <div class="ccf-summary-row"><strong>Yardımcılar:</strong> ${escapeHtml(s.helperCharacters.join(", ") || "-")}</div>
      <div class="ccf-summary-row"><strong>Sahne:</strong> ${escapeHtml(s.scene || "-")}</div>
      <div class="ccf-summary-row"><strong>Aksiyon:</strong> ${escapeHtml(s.action || "-")}</div>
      <div class="ccf-summary-row"><strong>Stil:</strong> ${escapeHtml(s.style || "-")}</div>
      <div class="ccf-summary-row"><strong>Süre:</strong> ${escapeHtml(s.duration || "-")}</div>
      <div class="ccf-summary-row"><strong>Ek Prompt:</strong> ${escapeHtml(s.extraPrompt || "-")}</div>
    `;
  }

  function bindEvents(root) {
    if (!root) return;

    root.addEventListener("click", function (e) {
      const single = e.target.closest("[data-choice-single]");
      if (single) {
        const group = single.getAttribute("data-group-name");
        const value = single.getAttribute("data-choice");
        setActiveChoice(group, value);
        renderSummary();
        return;
      }

      const multi = e.target.closest("[data-choice-multi]");
      if (multi) {
        const group = multi.getAttribute("data-group-name");
        const value = multi.getAttribute("data-choice");
        toggleMultiChoice(group, value);
        renderSummary();
        return;
      }

      const createBtn = e.target.closest("[data-ccf-create]");
      if (createBtn) {
        const s = collectState();

        if (!s.mainCharacter) {
          window.toast?.warning?.("Önce bir ana karakter seç.");
          return;
        }

        window.toast?.success?.("Çocuk Çizgifilm arayüzü hazır.");
        console.log("[CHILD_CARTOON_UI] state:", s);
      }
    });

    root.addEventListener("input", function (e) {
      if (e.target && e.target.id === "ccfExtraPrompt") {
        renderSummary();
      }
    });
  }

  function cardButton(label, value, opts) {
    const active = opts?.active ? " is-active" : "";
    const multi = !!opts?.multi;
    const attrs = multi
      ? `data-choice data-choice-multi data-group-name="${opts.group}" data-choice="${value}" aria-pressed="${opts.active ? "true" : "false"}"`
      : `data-choice data-choice-single data-group-name="${opts.group}" data-choice="${value}" aria-pressed="${opts.active ? "true" : "false"}"`;

    return `
      <button type="button" class="ccf-card${active}" ${attrs}>
        <span class="ccf-card-title">${escapeHtml(label)}</span>
      </button>
    `;
  }

  function pillButton(label, value, opts) {
    const active = opts?.active ? " is-active" : "";
    const multi = !!opts?.multi;
    const attrs = multi
      ? `data-choice data-choice-multi data-group-name="${opts.group}" data-choice="${value}" aria-pressed="${opts.active ? "true" : "false"}"`
      : `data-choice data-choice-single data-group-name="${opts.group}" data-choice="${value}" aria-pressed="${opts.active ? "true" : "false"}"`;

    return `
      <button type="button" class="ccf-pill${active}" ${attrs}>
        ${escapeHtml(label)}
      </button>
    `;
  }

  function template() {
    return `
      <section class="page ccf-page is-active" data-page="cartoon" aria-hidden="false">
        <div class="ccf-wrap">

          <div class="ccf-head">
            <div class="ccf-title">AI Çocuk Çizgifilm</div>
            <div class="ccf-sub">
              Hazır karakter seç, sahne kur, aksiyon belirle, sonra üretime geç.
            </div>
          </div>

          <div class="ccf-group" data-group="main-character">
            <div class="ccf-label">1. Ana Karakter</div>
            <div class="ccf-grid ccf-grid--cards">
              ${cardButton("Kırmızı Balık", "kirmizi-balik", { group: "main-character", active: true })}
              ${cardButton("Mavi Balık", "mavi-balik", { group: "main-character" })}
              ${cardButton("Kaplumbağa", "kaplumbaga", { group: "main-character" })}
              ${cardButton("Kurbağa", "kurbaga", { group: "main-character" })}
              ${cardButton("Ördek", "ordek", { group: "main-character" })}
            </div>
          </div>

          <div class="ccf-group" data-group="helper-characters">
            <div class="ccf-label">2. Yardımcı Karakterler</div>
            <div class="ccf-grid ccf-grid--cards">
              ${cardButton("Küçük Balıklar", "kucuk-baliklar", { group: "helper-characters", multi: true })}
              ${cardButton("Kaplumbağa", "kaplumbaga", { group: "helper-characters", multi: true })}
              ${cardButton("Kurbağa", "kurbaga", { group: "helper-characters", multi: true })}
              ${cardButton("Ördek", "ordek", { group: "helper-characters", multi: true })}
              ${cardButton("Deniz Kabukları", "deniz-kabuklari", { group: "helper-characters", multi: true })}
              ${cardButton("Baloncuklar", "baloncuklar", { group: "helper-characters", multi: true })}
            </div>
          </div>

          <div class="ccf-group" data-group="scene">
            <div class="ccf-label">3. Sahne</div>
            <div class="ccf-grid ccf-grid--pills">
              ${pillButton("Deniz Altı", "deniz-alti", { group: "scene", active: true })}
              ${pillButton("Gölet", "golet", { group: "scene" })}
              ${pillButton("Orman", "orman", { group: "scene" })}
              ${pillButton("Çiftlik", "ciftlik", { group: "scene" })}
              ${pillButton("Gökyüzü", "gokyuzu", { group: "scene" })}
            </div>
          </div>

          <div class="ccf-group" data-group="action">
            <div class="ccf-label">4. Aksiyon</div>
            <div class="ccf-grid ccf-grid--pills">
              ${pillButton("Yüzüyor", "yuzuyor", { group: "action", active: true })}
              ${pillButton("Zıplıyor", "zipliyor", { group: "action" })}
              ${pillButton("Oynuyor", "oynuyor", { group: "action" })}
              ${pillButton("Gülüyor", "guluyor", { group: "action" })}
              ${pillButton("Dans Ediyor", "dans-ediyor", { group: "action" })}
              ${pillButton("El Sallıyor", "el-salliyor", { group: "action" })}
              ${pillButton("Yavaşça İlerliyor", "yavasca-ilerliyor", { group: "action" })}
            </div>
          </div>

          <div class="ccf-group" data-group="style">
            <div class="ccf-label">5. Stil</div>
            <div class="ccf-grid ccf-grid--pills">
              ${pillButton("2D Basit", "2d-basit", { group: "style", active: true })}
              ${pillButton("2D Renkli", "2d-renkli", { group: "style" })}
              ${pillButton("3D Yumuşak", "3d-yumusak", { group: "style" })}
            </div>
          </div>

          <div class="ccf-group" data-group="duration">
            <div class="ccf-label">6. Süre</div>
            <div class="ccf-grid ccf-grid--pills">
              ${pillButton("5 sn", "5", { group: "duration" })}
              ${pillButton("10 sn", "10", { group: "duration" })}
              ${pillButton("15 sn", "15", { group: "duration", active: true })}
            </div>
          </div>

          <div class="ccf-group">
            <div class="ccf-label">7. Ek Prompt</div>
            <textarea
              id="ccfExtraPrompt"
              class="ccf-textarea"
              rows="4"
              placeholder="İstersen kısa bir ekstra not yaz. Örn: neşeli, yumuşak hareketler, bol baloncuk..."
            ></textarea>
          </div>

          <div class="ccf-actions">
            <button type="button" class="ccf-main-btn" data-ccf-create>
              Çizgifilm Sahnesi Oluştur
            </button>
          </div>

          <div class="ccf-summary">
            <div class="ccf-label">Seçim Özeti</div>
            <div id="ccfSummary" class="ccf-summary-box"></div>
          </div>

        </div>
      </section>
    `;
  }

  function mount() {
    if (!isCartoonRoute()) return;

    const host = getHost();
    if (!host) return;

    host.innerHTML = template();
    host.setAttribute("data-active-module", "cartoon");
    bindEvents(host);
    renderSummary();
  }

  function boot() {
    mount();

    window.addEventListener("hashchange", function () {
      setTimeout(mount, 30);
    });

    let lastHref = location.href;
    setInterval(function () {
      if (location.href !== lastHref) {
        lastHref = location.href;
        if (isCartoonRoute()) {
          setTimeout(mount, 30);
        }
      }
    }, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  console.log("[AIVO] CHILD_CARTOON_UI loaded");
})();
