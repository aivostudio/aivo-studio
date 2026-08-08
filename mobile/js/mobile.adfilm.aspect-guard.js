(function AIVO_MOBILE_ADFILM_ASPECT_GUARD_V4(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_ASPECT_GUARD_V4__) return;
  window.__AIVO_MOBILE_ADFILM_ASPECT_GUARD_V4__ = true;

  const selector = [
    "#mobileAdFilmPrimaryImage",
    "#mobileAdFilmAngleImages",
    "#mobileAdFilmSceneImages"
  ].join(",");

  const FAL_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const rejected = new Map();
  let rejectedSequence = 0;

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function toast(message){
    try {
      if (window.mobileToast && typeof window.mobileToast.warning === "function") {
        return window.mobileToast.warning(message, { duration: 5200 });
      }
      if (window.toast && typeof window.toast.warning === "function") {
        return window.toast.warning(message, { duration: 5200 });
      }
      if (typeof window.showToast === "function") return window.showToast(message, "warning");
    } catch (_) {}
    return null;
  }

  function rootFor(node){
    return node && node.closest ? node.closest("#mobileAdFilmSection") : document.getElementById("mobileAdFilmSection");
  }

  function galleryFor(root){
    return root && root.querySelector("#mobileAdFilmReferenceGallery");
  }

  function currentFormat(root){
    const active = root && root.querySelector("[data-mobile-adfilm-format].is-active");
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

  function actualOrientation(width, height){
    if (!width || !height) return "unknown";
    const delta = Math.abs(width - height) / Math.max(width, height);
    if (delta <= 0.08) return "square";
    return width > height ? "landscape" : "portrait";
  }

  function orientationLabel(value){
    if (value === "portrait") return "dikey";
    if (value === "square") return "kare";
    if (value === "landscape") return "yatay";
    return "ölçüsü okunamayan";
  }

  function compatible(format, width, height){
    const expected = expectedOrientation(format);
    const actual = actualOrientation(width, height);
    if (actual === "unknown") return false;
    if (expected === "square") return actual === "square";
    return actual === expected;
  }

  function normalizedFileType(file){
    const type = clean(file && file.type).toLowerCase();
    if (type === "image/jpg") return "image/jpeg";
    return type;
  }

  function ascii(bytes, start, end){
    let out = "";
    for (let i = start; i < end && i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
    return out;
  }

  async function sniffImageFormat(file){
    try {
      const buffer = await file.slice(0, 32).arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return { ok:true, type:"image/jpeg", label:"JPEG" };
      }

      if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
        bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
      ) {
        return { ok:true, type:"image/png", label:"PNG" };
      }

      if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
        return { ok:true, type:"image/webp", label:"WebP" };
      }

      if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
        const brand = ascii(bytes, 8, 12).toLowerCase();
        if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) {
          return { ok:false, type:"image/heif", label:"HEIF/HEIC" };
        }
        if (["avif", "avis"].includes(brand)) {
          return { ok:false, type:"image/avif", label:"AVIF" };
        }
        return { ok:false, type:"application/octet-stream", label:"DESTEKLENMEYEN FORMAT" };
      }

      return { ok:false, type:"application/octet-stream", label:"BİLİNMEYEN FORMAT" };
    } catch (_) {
      return { ok:false, type:"application/octet-stream", label:"FORMAT OKUNAMADI" };
    }
  }

  async function supportedFalImage(file){
    const declaredType = normalizedFileType(file);
    const name = clean(file && file.name).toLowerCase();
    const declaredAllowed = declaredType
      ? FAL_IMAGE_TYPES.has(declaredType)
      : /\.(jpe?g|png|webp)$/i.test(name);

    const sniffed = await sniffImageFormat(file);
    if (!sniffed.ok) return { ok:false, label:sniffed.label };
    if (!declaredAllowed) return { ok:false, label:sniffed.label };
    if (declaredType && declaredType !== sniffed.type) return { ok:false, label:sniffed.label };
    return { ok:true, label:sniffed.label, type:sniffed.type };
  }

  async function imageDimensions(file){
    if (!file) return { width:0, height:0 };

    if (typeof window.createImageBitmap === "function") {
      try {
        const bitmap = await window.createImageBitmap(file);
        const result = {
          width: Number(bitmap && bitmap.width || 0),
          height: Number(bitmap && bitmap.height || 0)
        };
        try { if (bitmap && typeof bitmap.close === "function") bitmap.close(); } catch (_) {}
        if (result.width && result.height) return result;
      } catch (_) {}
    }

    return new Promise(function(resolve){
      let url = "";
      try {
        url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = function(){
          const result = {
            width: Number(image.naturalWidth || image.width || 0),
            height: Number(image.naturalHeight || image.height || 0)
          };
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

  function removeRejected(id){
    const entry = rejected.get(id);
    if (entry && entry.previewUrl) {
      try { URL.revokeObjectURL(entry.previewUrl); } catch (_) {}
    }
    rejected.delete(id);
    const node = document.querySelector('[data-aspect-rejected-id="' + id + '"]');
    if (node) node.remove();
  }

  function addRejected(root, file, meta, reason, formatLabel){
    const gallery = galleryFor(root);
    if (!gallery) return;

    rejectedSequence += 1;
    const id = "aspect-rejected-" + Date.now().toString(36) + "-" + rejectedSequence.toString(36);
    const previewUrl = filePreview(file);
    const actual = actualOrientation(meta.width, meta.height);
    rejected.set(id, { previewUrl:previewUrl });

    const thumb = document.createElement("div");
    thumb.className = "mobile-adfilm-reference-thumb is-aspect-invalid";
    thumb.setAttribute("data-aspect-rejected-id", id);
    thumb.setAttribute("role", "status");
    thumb.setAttribute("aria-label", "Uyumsuz referans görseli");

    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = "Uyumsuz referans görseli";
    thumb.appendChild(image);

    const cross = document.createElement("span");
    cross.className = "mobile-adfilm-aspect-error-cross";
    cross.setAttribute("aria-hidden", "true");
    thumb.appendChild(cross);

    const badge = document.createElement("span");
    badge.className = "mobile-adfilm-reference-thumb-label mobile-adfilm-aspect-error-label";
    badge.textContent = reason === "format"
      ? "DESTEKLENMİYOR · " + clean(formatLabel || "FORMAT")
      : actual === "unknown"
        ? "FORMAT OKUNAMADI"
        : "UYUMSUZ · " + orientationLabel(actual).toUpperCase();
    thumb.appendChild(badge);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "mobile-adfilm-reference-delete";
    remove.setAttribute("data-aspect-rejected-remove", id);
    remove.setAttribute("aria-label", "Uyumsuz görsel uyarısını kapat");
    thumb.appendChild(remove);

    gallery.appendChild(thumb);

    while (rejected.size > 3) {
      const oldest = rejected.keys().next().value;
      removeRejected(oldest);
    }
  }

  function warningMessage(format, meta, reason, formatLabel){
    if (reason === "format") {
      return clean(formatLabel || "Bu dosya") + " desteklenmiyor. Reklam filmi referanslarında yalnız JPEG, PNG veya WebP kullanabilirsin.";
    }

    const actual = actualOrientation(meta.width, meta.height);
    if (actual === "unknown") {
      return "Görselin yönü okunamadı. Lütfen JPEG, PNG veya WebP olarak tekrar yükle.";
    }
    const expected = expectedOrientation(format);
    return "Seçtiğin video formatıyla bu görsel uyumlu değil. " + format + " için " + orientationLabel(expected) + " görsel yüklemelisin; seçtiğin görsel " + orientationLabel(actual) + ".";
  }

  function dispatchFilteredChange(input, valid){
    if (!valid.length) {
      input.value = "";
      return false;
    }
    try {
      const transfer = new DataTransfer();
      valid.forEach(function(file){ transfer.items.add(file); });
      input.files = transfer.files;
    } catch (error) {
      console.warn("[MOBILE ADFILM] filtered FileList unavailable", error);
      input.value = "";
      return false;
    }
    input.dataset.adfilmAspectGuardPass = "1";
    input.dispatchEvent(new Event("change", { bubbles:true }));
    delete input.dataset.adfilmAspectGuardPass;
    return true;
  }

  async function validateFiles(root, input, files){
    const format = currentFormat(root);
    const valid = [];
    const invalid = [];

    for (const file of files) {
      const formatCheck = await supportedFalImage(file);
      if (!formatCheck.ok) {
        invalid.push({ file:file, meta:{ width:0, height:0 }, reason:"format", formatLabel:formatCheck.label });
        continue;
      }

      const meta = await imageDimensions(file);
      if (!meta.width || !meta.height || !compatible(format, meta.width, meta.height)) {
        invalid.push({ file:file, meta:meta, reason:"aspect", formatLabel:formatCheck.label });
      } else {
        valid.push(file);
      }
    }

    dispatchFilteredChange(input, valid);
    if (!invalid.length) return;

    invalid.forEach(function(item){ addRejected(root, item.file, item.meta, item.reason, item.formatLabel); });
    toast(warningMessage(format, invalid[0].meta, invalid[0].reason, invalid[0].formatLabel));
  }

  document.addEventListener("change", function(event){
    const input = event.target && event.target.closest && event.target.closest(selector);
    if (!input || input.dataset.adfilmAspectGuardPass === "1") return;
    const root = rootFor(input);
    if (!root) return;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    validateFiles(root, input, files).catch(function(error){
      console.error("[MOBILE ADFILM] aspect validation", error);
      input.value = "";
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

  window.addEventListener("pagehide", function(){
    Array.from(rejected.keys()).forEach(removeRejected);
  }, { once:true });
})();