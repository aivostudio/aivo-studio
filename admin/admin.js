// /admin/admin.js
// Lightweight loader that preserves the existing admin logic in admin-core.js
// and adds direct image upload support to the Push Kampanya image URL field.
(function () {
  "use strict";

  const CORE_SRC = "./admin-core.js?v=20260819-push-image-upload-1";
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);

  function onDomReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function loadAdminCore() {
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-aivo-admin-core="1"]');
      if (existing) {
        if (existing.dataset.loaded === "1") resolve();
        else existing.addEventListener("load", resolve, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = CORE_SRC;
      script.async = false;
      script.dataset.aivoAdminCore = "1";
      script.addEventListener("load", function () {
        script.dataset.loaded = "1";
        resolve();
      }, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.appendChild(script);
    });
  }

  function createElement(tag, attrs, text) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "style" && attrs[key] && typeof attrs[key] === "object") {
        Object.assign(el.style, attrs[key]);
      } else if (key === "className") {
        el.className = attrs[key];
      } else {
        el.setAttribute(key, attrs[key]);
      }
    });
    if (text != null) el.textContent = text;
    return el;
  }

  function injectPushImageUploader() {
    const urlInput = document.getElementById("pushImageUrl");
    if (!urlInput || document.getElementById("pushImageUploadControls")) return;

    const wrap = createElement("div", {
      id: "pushImageUploadControls",
      style: {
        display: "grid",
        gap: "10px",
        marginTop: "10px"
      }
    });

    const actionRow = createElement("div", {
      style: {
        display: "flex",
        gap: "10px",
        alignItems: "center",
        flexWrap: "wrap"
      }
    });

    const fileInput = createElement("input", {
      id: "pushImageFile",
      type: "file",
      accept: "image/jpeg,image/png,image/webp",
      style: { display: "none" }
    });

    const uploadButton = createElement("button", {
      id: "btnPushImageUpload",
      type: "button",
      className: "btn",
      style: {
        minWidth: "150px",
        height: "42px",
        borderRadius: "12px",
        fontWeight: "700"
      }
    }, "📷 Resim Yükle");

    const clearButton = createElement("button", {
      id: "btnPushImageClear",
      type: "button",
      className: "btn",
      style: {
        height: "42px",
        borderRadius: "12px"
      }
    }, "Temizle");

    const status = createElement("span", {
      id: "pushImageUploadStatus",
      className: "muted",
      style: {
        fontSize: "12px",
        minHeight: "18px"
      }
    }, "JPG, PNG veya WebP seçebilirsin. Maksimum 5 MB.");

    const preview = createElement("img", {
      id: "pushImagePreview",
      alt: "Push bildirim görseli önizlemesi",
      style: {
        display: "none",
        width: "180px",
        maxWidth: "100%",
        maxHeight: "180px",
        objectFit: "cover",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,.10)",
        background: "#0b0f17"
      }
    });

    actionRow.appendChild(fileInput);
    actionRow.appendChild(uploadButton);
    actionRow.appendChild(clearButton);
    actionRow.appendChild(status);
    wrap.appendChild(actionRow);
    wrap.appendChild(preview);

    urlInput.insertAdjacentElement("afterend", wrap);

    function setPreview(url) {
      const cleanUrl = String(url || "").trim();
      if (!cleanUrl) {
        preview.removeAttribute("src");
        preview.style.display = "none";
        return;
      }
      preview.src = cleanUrl;
      preview.style.display = "block";
    }

    uploadButton.addEventListener("click", function () {
      fileInput.click();
    });

    clearButton.addEventListener("click", function () {
      fileInput.value = "";
      urlInput.value = "";
      setPreview("");
      status.textContent = "Görsel kaldırıldı.";
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    urlInput.addEventListener("change", function () {
      setPreview(urlInput.value);
    });

    fileInput.addEventListener("change", async function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.has(String(file.type || "").toLowerCase())) {
        fileInput.value = "";
        status.textContent = "Hata: Sadece JPG, PNG veya WebP yükleyebilirsin.";
        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        fileInput.value = "";
        status.textContent = "Hata: Görsel 5 MB'dan küçük olmalı.";
        return;
      }

      uploadButton.disabled = true;
      clearButton.disabled = true;
      status.textContent = "Görsel yükleniyor...";

      try {
        const presignResponse = await fetch("/api/r2/presign-put", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            filename: file.name || "push-image",
            contentType: file.type,
            prefix: "uploads/admin/push/",
            app: "admin",
            kind: "push-image"
          })
        });

        const presign = await presignResponse.json().catch(function () { return null; });
        if (!presignResponse.ok || !presign || !presign.ok || !presign.upload_url || !presign.public_url) {
          throw new Error((presign && (presign.error || presign.message)) || "presign_failed");
        }

        const uploadResponse = await fetch(presign.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file
        });

        if (!uploadResponse.ok) {
          throw new Error("upload_failed_" + String(uploadResponse.status));
        }

        urlInput.value = String(presign.public_url);
        urlInput.dispatchEvent(new Event("input", { bubbles: true }));
        urlInput.dispatchEvent(new Event("change", { bubbles: true }));
        setPreview(presign.public_url);
        status.textContent = "✅ Görsel yüklendi. URL otomatik eklendi.";
      } catch (err) {
        console.error("Push image upload failed:", err);
        status.textContent = "Hata: Görsel yüklenemedi. " + String(err && err.message ? err.message : err);
      } finally {
        uploadButton.disabled = false;
        clearButton.disabled = false;
      }
    });
  }

  onDomReady(async function () {
    try {
      await loadAdminCore();
    } catch (err) {
      console.error("AIVO admin core failed to load:", err);
      return;
    }

    injectPushImageUploader();
  });
})();
