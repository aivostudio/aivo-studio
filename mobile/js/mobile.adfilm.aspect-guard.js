(function AIVO_MOBILE_ADFILM_ASPECT_GUARD(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_ASPECT_GUARD_V1__) return;
  window.__AIVO_MOBILE_ADFILM_ASPECT_GUARD_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  if (!root) return;

  const gallery = root.querySelector("#mobileAdFilmReferenceGallery");
  const selector = [
    "#mobileAdFilmPrimaryImage",
    "#mobileAdFilmAngleImages",
    "#mobileAdFilmSceneImages"
  ].join(",");

  const rejected = new Map();
  let rejectedSequence = 0;
  let renderingRejected = false;

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function toast(message){
    try {
      if (window.toast && typeof window.toast.warning === "function") {
        return window.toast.warning({ message: message, duration: 5200 });
      }
      if (window.mobileToast && typeof window.mobileToast.warning === "function") {
        return window.mobileToast.warning(message, { duration: 5200 });
      }
      if (typeof window.showToast === "function") return window.showToast(message, "warning");
    } catch (_) {}
    return null;
  }

  function currentFormat(){
    const active = root.querySelector("[data-mobile-adfilm-format].is-active");
    const fromButton = clean(active && active.getAttribute("data-mobile-adfilm-format"));
    if (fromButton) return fromButton;
    const source = window.AIVOAdFilmActiveProject || {};
    return clean(source.output && source.output.aspectRatio) || "16:9";
  }

  function expectedOrientation(format){
    if (format === "1:1") return "square";
    if (["9:16", "4:5", "3:4"].includes(format)) return "portrait";
    return "landscape";
  }

  function orientationLabel(value){
    if (value === "portrait") return "dikey";
    if (value === "square") return "kare";
    return "yatay";
  }

  function actualOrientation(width, height){
    if (!width || !height) return "unknown";
    const delta = Math.abs(width - height) / Math.max(width, height);
    if (delta <= 0.08) return "square";
    return width > height ? "landscape" : "portrait";
  }

  function compatible(format, width, height){
    const expected = expectedOrientation(format);
    const actual = actualOrientation(width, height);
    if (actual === "unknown") return false;
    if (expected === "square") return actual === "square";
    return actual === expected;
  }

  function imageDimensions(file){
    return new Promise(function(resolve){
      let url = "";
      try {
        url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = function(){
          const result = { width: Number(image.naturalWidth || image.width || 0), height: Number(image.naturalHeight || image.height || 0) };
          try { URL.revokeObjectURL(url); } catch (_) {}
          resolve(result);
        };
        image.onerror = function(){
          try { URL.revokeObjectURL(url); } catch (_) {}
          resolve({ width:0, height:0 });
        };
        image.src = url;
      } catch (_) {
        if (url) { try { URL.revokeObjectURL(url); } catch (_) {} }
        resolve({ width:0, height:0 });
      }
    });
  }

  function filePreview(file){
    try { return URL.createObjectURL(file); } catch (_) { return ""; }
  }

  function rejectedLabel(meta){
    const actual = actualOrientation(meta.width, meta.height);
    return "UYUMSUZ · " + orientationLabel(actual).toUpperCase();
  }

  function removeRejected(id){
    const entry = rejected.get(id);
    if (entry && entry.previewUrl) {
      try { URL.revokeObjectURL(entry.previewUrl); } catch (_) {}
    }
    rejected.delete(id);
    if (gallery) {
      const node = gallery.querySelector('[data-aspect-rejected-id="' + id + '"]');
      if (node) node.remove();
    }
  }

  function addRejected(file, meta, format){
    rejectedSequence += 1;
    const id = "aspect-rejected-" + Date.now().toString(36) + "-" + rejectedSequence.toString(36);
    rejected.set(id, {
      id: id,
      previewUrl: filePreview(file),
      format: format,
      width: meta.width,
      height: meta.height,
      label: rejectedLabel(meta)
    });

    while (rejected.size > 3) {
      const oldest = rejected.keys().next().value;
      removeRejected(oldest);
    }
    renderRejected();
  }

  function renderRejected(){
    if (!gallery || renderingRejected) return;
    renderingRejected = true;
    try {
      rejected.forEach(function(entry){
        if (gallery.querySelector('[data-aspect-rejected-id="' + entry.id + '"]')) return;

        const thumb = document.createElement("div");
        thumb.className = "mobile-adfilm-reference-thumb is-aspect-invalid";
        thumb.setAttribute("data-aspect-rejected-id", entry.id);
        thumb.setAttribute("role", "status");
        thumb.setAttribute("aria-label", "Uyumsuz referans görseli");

        const image = document.createElement("img");
        image.src = entry.previewUrl;
        image.alt = "Uyumsuz referans görseli";
        thumb.appendChild(image);

        const cross = document.createElement("span");
        cross.className = "mobile-adfilm-aspect-error-cross";
        cross.setAttribute("aria-hidden", "true");
        thumb.appendChild(cross);

        const badge = document.createElement("span");
        badge.className = "mobile-adfilm-reference-thumb-label mobile-adfilm-aspect-error-label";
        badge.textContent = entry.label;
        thumb.appendChild(badge);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "mobile-adfilm-reference-delete";
        remove.setAttribute("data-aspect-rejected-remove", entry.id);
        remove.setAttribute("aria-label", "Uyumsuz görsel uyarısını kapat");
        thumb.appendChild(remove);

        gallery.appendChild(thumb);
      });
    } finally {
      renderingRejected = false;
    }
  }

  function warningMessage(format, meta){
    const actual = actualOrientation(meta.width, meta.height);
    const expected = expectedOrientation(format);
    return "Seçtiğin video formatıyla bu görsel uyumlu değil. " +
      format + " için " + orientationLabel(expected) + " görsel yüklemelisin; seçtiğin görsel " + orientationLabel(actual) + ".";
  }

  async function validateFiles(input, files){
    const format = currentFormat();
    const valid = [];
    const invalid = [];

    for (const file of files) {
      const type = clean(file && file.type).toLowerCase();
      if (!/^(image\/jpeg|image\/png|image\/webp)$/.test(type)) {
        valid.push(file);
        continue;
      }

      const meta = await imageDimensions(file);
      if (!meta.width || !meta.height || !compatible(format, meta.width, meta.height)) {
        invalid.push({ file:file, meta:meta });
      } else {
        valid.push(file);
      }
    }

    const transfer = new DataTransfer();
    valid.forEach(function(file){ transfer.items.add(file); });
    input.files = transfer.files;

    input.dataset.adfilmAspectGuardPass = "1";
    input.dispatchEvent(new Event("change", { bubbles:true }));
    delete input.dataset.adfilmAspectGuardPass;

    invalid.forEach(function(item){ addRejected(item.file, item.meta, format); });

    if (invalid.length) {
      const first = invalid[0];
      toast(warningMessage(format, first.meta));
    }
  }

  document.addEventListener("change", function(event){
    const input = event.target && event.target.closest && event.target.closest(selector);
    if (!input || !root.contains(input)) return;
    if (input.dataset.adfilmAspectGuardPass === "1") return;

    const files = Array.from(input.files || []);
    if (!files.length) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    validateFiles(input, files).catch(function(error){
      console.error("[MOBILE ADFILM] aspect validation", error);
      toast("Görsel formatı kontrol edilemedi. Lütfen görseli tekrar seç.");
    });
  }, true);

  document.addEventListener("click", function(event){
    const button = event.target && event.target.closest && event.target.closest("[data-aspect-rejected-remove]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    removeRejected(clean(button.getAttribute("data-aspect-rejected-remove")));
  }, true);

  if (gallery) {
    const observer = new MutationObserver(function(){
      if (!renderingRejected && rejected.size) renderRejected();
    });
    observer.observe(gallery, { childList:true });
  }

  window.addEventListener("pagehide", function(){
    Array.from(rejected.keys()).forEach(removeRejected);
  }, { once:true });
})();