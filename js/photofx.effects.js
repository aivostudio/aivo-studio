console.log("[photofx.effects] lightweight loaded ✅");

(function () {
  if (window.__AIVO_PHOTOFX_EFFECTS__) return;
  window.__AIVO_PHOTOFX_EFFECTS__ = true;

  function buildEffectsPayload(form = {}) {
    return {
      preset: String(form.style || "").trim(),
      styles: Array.isArray(form.styles) ? [...form.styles] : []
    };
  }

  window.AIVOPhotoFxEffects = {
    buildEffectsPayload
  };
})();
