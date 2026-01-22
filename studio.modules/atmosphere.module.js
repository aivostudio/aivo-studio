// /studio.modules/atmosphere.module.js
(() => {
  const ROOT_ID = "atmEffects";
  const BTN_SEL = "button.atm-pill";

  function setActive(btn, on) {
    btn.classList.toggle("is-active", !!on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function getSelected(root) {
    return Array.from(root.querySelectorAll(`${BTN_SEL}.is-active`))
      .map(b => b.dataset.atmEff || b.textContent.trim())
      .filter(Boolean);
  }

  function writeState(selected, root) {
    // 1) DOM dataset (debug + başka kodlar okursa)
    root.dataset.atmSelected = JSON.stringify(selected);

    // 2) Global STATE (studio.js / studio.app.js hangisi okuyorsa)
    const S = (window.STATE = window.STATE || {});
    S.atmosphere = S.atmosphere || {};
    S.atmosphere.effects = selected;

    // legacy farklı isim okuyorsa diye yedek:
    S.atmEffects = selected;
    window.__ATM_EFFECTS__ = selected;
  }

  function showWarn(msg) {
    const warn = document.getElementById("atmWarn");
    if (!warn) return;
    warn.style.display = "block";
    warn.textContent = msg;
    clearTimeout(warn._t);
    warn._t = setTimeout(() => (warn.style.display = "none"), 1200);
  }

  function bind() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;

    // çift bind engeli
    if (root.dataset.atmBound === "1") return;
    root.dataset.atmBound = "1";

    // ilk state yaz
    writeState(getSelected(root), root);

    // ✅ Capture + stopImmediatePropagation: legacy click handler’larını ez
    root.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest(BTN_SEL);
        if (!btn || !root.contains(btn)) return;

        // en kritik satırlar:
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        const isOn = btn.classList.contains("is-active");
        setActive(btn, !isOn);

        const selected = getSelected(root);
        writeState(selected, root);

        // 0 seçime düşerse uyar (Video Oluştur validasyonuna da yardımcı)
        if (selected.length === 0) {
          showWarn("En az 1 atmosfer seçmelisin.");
        } else {
          const warn = document.getElementById("atmWarn");
          if (warn) warn.style.display = "none";
        }
      },
      true // capture
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }

  // Panel değişimi varsa yeniden bağla
  document.addEventListener("aivo:pagechange", bind);
})();
