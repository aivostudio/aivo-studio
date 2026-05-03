(() => {
  if (window.__AIVO_LIPSYNC_MODULE_BIND__) return;
  window.__AIVO_LIPSYNC_MODULE_BIND__ = true;

  const CREDIT_BY_DURATION = {
    "10": 15,
    "20": 30,
    "30": 45,
    "40": 60,
    "50": 75,
    "60": 90
  };

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function getRoot() {
    return qs('.main-panel[data-module="lipsync"]');
  }

  function getSelectedDuration(root) {
    const durationSelect = qs("[data-lipsync-duration]", root);
    return String(durationSelect?.value || "10");
  }

  function getCreditCost(duration) {
    return CREDIT_BY_DURATION[String(duration || "10")] || 15;
  }

  function syncGenerateButton(root) {
    const btn = qs("[data-lipsync-generate]", root);
    if (!btn) return;

    const duration = getSelectedDuration(root);
    const credit = getCreditCost(duration);

    btn.dataset.creditCost = String(credit);
    btn.textContent = `Dudak Senkron Video Üret (${credit} Kredi)`;
  }

  function buildPayload(root) {
    const script = qs("[data-lipsync-script]", root);
    const resolution = qs("[data-lipsync-resolution]", root);
    const duration = getSelectedDuration(root);
    const credit = getCreditCost(duration);

    return {
      app: "lipsync",
      script: String(script?.value || "").trim(),
      resolution: String(resolution?.value || "1080p"),
      duration,
      estimatedCredits: credit
    };
  }

  function bindEvents() {
    document.addEventListener("change", (e) => {
      const root = getRoot();
      if (!root) return;
            const photoInput = e.target.closest("[data-lipsync-photo]");
      if (photoInput && root.contains(photoInput)) {
        const file = photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
        const empty = qs("[data-lipsync-photo-empty]", root);
        const preview = qs("[data-lipsync-photo-preview]", root);
        const name = qs("[data-lipsync-photo-name]", root);
        const photoLabel = qs(".lipsync-photo-label", root);

        if (!file) return;

        const url = URL.createObjectURL(file);

        if (empty) empty.style.display = "none";

       if (preview) {
  preview.onload = function () {
    const isLandscape = preview.naturalWidth > preview.naturalHeight;

    if (photoLabel) {
      photoLabel.classList.toggle("is-landscape", isLandscape);
      photoLabel.classList.toggle("is-portrait", !isLandscape);
    }
  };

  preview.src = url;
  preview.style.display = "block";
}
        if (photoLabel) {
        photoLabel.style.setProperty("--lipsync-photo-bg", `url("${url}")`);
        photoLabel.classList.add("has-photo-bg");
        }

        if (name) {
        const rawName = file.name || "Fotoğraf";
       const shortName =
       rawName.length > 18
    ? rawName.slice(0, 10) + "..." + rawName.split('.').pop()
    : rawName;

      name.textContent = shortName;
          
          name.style.display = "block";
        }

        console.log("[LIPSYNC][PHOTO_SELECTED]", {
          name: file.name,
          type: file.type,
          size: file.size
        });

        return;
      }

      const durationSelect = e.target.closest("[data-lipsync-duration]");
      if (!durationSelect || !root.contains(durationSelect)) return;

      syncGenerateButton(root);
    });

    document.addEventListener("click", (e) => {
      const root = getRoot();
      if (!root) return;
      

      const generateBtn = e.target.closest("[data-lipsync-generate]");
      if (!generateBtn || !root.contains(generateBtn)) return;

      e.preventDefault();

        const payload = buildPayload(root);

        if (!payload.script) {
        try { window.toast?.info?.("Konuşma metni yazmalısın"); } catch {}
        const scriptInput = qs("[data-lipsync-script]", root);
        if (scriptInput) scriptInput.focus();
        console.log("[LIPSYNC][BLOCKED]", "missing_script");
        return;
      }

      const photoInput = qs("[data-lipsync-photo]", root);
      const hasPhoto = !!(photoInput && photoInput.files && photoInput.files[0]);

      if (!hasPhoto) {
        try { window.toast?.info?.("Fotoğraf yüklemelisin"); } catch {}
        const photoLabel = qs(".lipsync-photo-label", root);
        if (photoLabel) photoLabel.scrollIntoView({ behavior: "smooth", block: "center" });
        console.log("[LIPSYNC][BLOCKED]", "missing_photo");
        return;
      }

      console.log("[LIPSYNC][PAYLOAD]", payload);
    });
  }

  function init() {
    const root = getRoot();
    if (!root) return false;

    syncGenerateButton(root);
    return true;
  }

  bindEvents();

  if (!init()) {
    const observer = new MutationObserver(() => {
      if (init()) observer.disconnect();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
