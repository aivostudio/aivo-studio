// /admin/admin.js
// Lightweight loader that preserves the existing admin logic in admin-core.js
// and adds direct image upload support to the Push Kampanya image URL field.
(function () {
  "use strict";

  const CORE_SRC = "./admin-core.js?v=20260819-push-image-upload-2";
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

    let localPreviewUrl = "";

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

    const previewCard = createElement("div", {
      id: "pushImagePreviewCard",
      style: {
        display: "none",
        gridTemplateColumns: "180px minmax(0, 1fr)",
        gap: "14px",
        alignItems: "center",
        maxWidth: "620px",
        padding: "12px",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(7,12,20,.55)"
      }
    });

    const preview = createElement("img", {
      id: "pushImagePreview",
      alt: "Push bildirim görseli önizlemesi",
      style: {
        display: "block",
        width: "180px",
        height: "130px",
        maxWidth: "100%",
        objectFit: "cover",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,.10)",
        background: "#0b0f17"
      }
    });

    const previewInfo = createElement("div", {
      style: {
        display: "grid",
        gap: "6px",
        minWidth: "0"
      }
    });

    const previewTitle = createElement("strong", {
      id: "pushImagePreviewTitle",
      style: { fontSize: "13px" }
    }, "Seçilen görsel");

    const previewName = createElement("span", {
      id: "pushImagePreviewName",
      className: "muted",
      style: {
        fontSize: "12px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, "-");

    const previewMeta = createElement("span", {
      id: "pushImagePreviewMeta",
      className: "muted",
      style: { fontSize: "12px" }
    }, "");

    previewInfo.appendChild(previewTitle);
    previewInfo.appendChild(previewName);
    previewInfo.appendChild(previewMeta);
    previewCard.appendChild(preview);
    previewCard.appendChild(previewInfo);

    actionRow.appendChild(fileInput);
    actionRow.appendChild(uploadButton);
    actionRow.appendChild(clearButton);
    actionRow.appendChild(status);
    wrap.appendChild(actionRow);
    wrap.appendChild(previewCard);

    urlInput.insertAdjacentElement("afterend", wrap);

    function revokeLocalPreview() {
      if (localPreviewUrl) {
        try { URL.revokeObjectURL(localPreviewUrl); } catch (_) {}
        localPreviewUrl = "";
      }
    }

    function hidePreview() {
      revokeLocalPreview();
      preview.removeAttribute("src");
      previewCard.style.display = "none";
      previewName.textContent = "-";
      previewMeta.textContent = "";
    }

    function showPreview(url, name, meta) {
      const cleanUrl = String(url || "").trim();
      if (!cleanUrl) {
        hidePreview();
        return;
      }
      preview.src = cleanUrl;
      previewName.textContent = String(name || "Görsel");
      previewMeta.textContent = String(meta || "");
      previewCard.style.display = "grid";
    }

    uploadButton.addEventListener("click", function () {
      fileInput.click();
    });

    clearButton.addEventListener("click", function () {
      fileInput.value = "";
      urlInput.value = "";
      hidePreview();
      status.textContent = "Görsel kaldırıldı.";
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    urlInput.addEventListener("change", function () {
      const value = String(urlInput.value || "").trim();
      if (value) showPreview(value, "URL ile seçilen görsel", "Push bildirimi için kullanılacak görsel");
      else hidePreview();
    });

    fileInput.addEventListener("change", async function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.has(String(file.type || "").toLowerCase())) {
        fileInput.value = "";
        hidePreview();
        status.textContent = "Hata: Sadece JPG, PNG veya WebP yükleyebilirsin.";
        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        fileInput.value = "";
        hidePreview();
        status.textContent = "Hata: Görsel 5 MB'dan küçük olmalı.";
        return;
      }

      revokeLocalPreview();
      localPreviewUrl = URL.createObjectURL(file);
      const sizeKb = Math.max(1, Math.round(file.size / 1024));
      showPreview(localPreviewUrl, file.name || "Seçilen görsel", sizeKb + " KB • yükleme bekleniyor");

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
        revokeLocalPreview();
        showPreview(presign.public_url, file.name || "Yüklenen görsel", sizeKb + " KB • yükleme tamamlandı");
        status.textContent = "✅ Görsel yüklendi. URL otomatik eklendi.";
      } catch (err) {
        console.error("Push image upload failed:", err);
        previewMeta.textContent = sizeKb + " KB • yükleme başarısız";
        status.textContent = "Hata: Görsel yüklenemedi. " + String(err && err.message ? err.message : err);
      } finally {
        uploadButton.disabled = false;
        clearButton.disabled = false;
      }
    });
  }

  function installIosSalesDailyReportFix() {
    const status = document.getElementById("iosSalesStatus");
    const units = document.getElementById("iosSalesUnits");
    const customerTotal = document.getElementById("iosSalesCustomerTotal");
    const proceedsTotal = document.getElementById("iosSalesProceedsTotal");
    const tbody = document.getElementById("iosSalesTbody");
    const out = document.getElementById("iosSalesOut");

    if (!status || status.__aivoIosDailyReportFix) return;
    status.__aivoIosDailyReportFix = true;

    function escapeHtml(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function money(value) {
      return Number(value || 0).toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    function groupMoney(rows, amountKey, currencyKey) {
      const totals = new Map();

      rows.forEach(function (row) {
        const qty = Number(row.Units || 0);
        const amount = Number(row[amountKey] || 0);
        const currency = String(row[currencyKey] || "TRY").trim() || "TRY";
        totals.set(currency, (totals.get(currency) || 0) + amount * qty);
      });

      if (!totals.size) return "0,00 TRY";

      return Array.from(totals.entries())
        .map(function (entry) {
          return money(entry[1]) + " " + entry[0];
        })
        .join(" + ");
    }

    function parsePayload() {
      try {
        const raw = String(out && out.textContent ? out.textContent : "").trim();
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }

    function paidRowsFrom(payload) {
      const rows = payload && Array.isArray(payload.rows) ? payload.rows : [];
      return rows.filter(function (row) {
        const customerPrice = Number(row["Customer Price"] || 0);
        const developerProceeds = Number(row["Developer Proceeds"] || 0);
        return customerPrice > 0 || developerProceeds > 0;
      });
    }

    function renderTable(rows, emptyText) {
      if (!tbody) return;

      if (!rows.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="muted" style="padding:12px;">
              ${escapeHtml(emptyText)}
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = rows.map(function (row) {
        return `
          <tr>
            <td style="padding:8px 10px;">${escapeHtml(row.SKU || row.Title || "-")}</td>
            <td style="padding:8px 10px;">${Number(row.Units || 0)}</td>
            <td style="padding:8px 10px;">${escapeHtml(money(row["Customer Price"]) + " " + String(row["Customer Currency"] || "TRY"))}</td>
            <td style="padding:8px 10px;">${escapeHtml(money(row["Developer Proceeds"]) + " " + String(row["Currency of Proceeds"] || "TRY"))}</td>
            <td style="padding:8px 10px;">${escapeHtml(row["Customer Currency"] || row["Currency of Proceeds"] || "-")}</td>
            <td style="padding:8px 10px;">${escapeHtml(row["Country Code"] || "-")}</td>
            <td style="padding:8px 10px;">${escapeHtml(row.Device || "-")}</td>
          </tr>
        `;
      }).join("");
    }

    function sync() {
      const text = String(status.textContent || "").trim();
      if (!text.startsWith("Gün:")) return;

      const payload = parsePayload();
      if (!payload || !payload.ok) return;

      const date = String(payload.date || "-");
      const reportReady = payload.report_ready !== false;
      const rows = paidRowsFrom(payload);
      const totalUnits = rows.reduce(function (sum, row) {
        return sum + Number(row.Units || 0);
      }, 0);

      if (units) units.textContent = String(totalUnits);
      if (customerTotal) customerTotal.textContent = groupMoney(rows, "Customer Price", "Customer Currency");
      if (proceedsTotal) proceedsTotal.textContent = groupMoney(rows, "Developer Proceeds", "Currency of Proceeds");

      if (!reportReady) {
        renderTable([], "Apple günlük satış raporu henüz hazır değil.");
        const next = `Gün: ${date} / Apple günlük raporu henüz hazır değil`;
        if (status.textContent !== next) status.textContent = next;
        return;
      }

      if (!rows.length) {
        renderTable([], "Seçilen gün için iOS satış adedi: 0.");
        const next = `Gün: ${date} / Satış: 0`;
        if (status.textContent !== next) status.textContent = next;
        return;
      }

      renderTable(rows, "");
      const next = `Gün: ${date} / Satış: ${totalUnits}`;
      if (status.textContent !== next) status.textContent = next;
    }

    const observer = new MutationObserver(sync);
    observer.observe(status, {
      childList: true,
      characterData: true,
      subtree: true
    });

    sync();
  }

  function installTrafficSoftPinkStyle() {
    if (document.getElementById("aivoTrafficSoftPinkStyle")) return;

    const style = document.createElement("style");
    style.id = "aivoTrafficSoftPinkStyle";
    style.textContent = `
      #cardTrafficStats > div:nth-of-type(2) > div,
      #trafficLast7,
      #trafficTopPages {
        background:
          linear-gradient(180deg, rgba(255, 168, 196, .055), rgba(255, 138, 177, .026)),
          rgba(255,255,255,.018) !important;
        border-color: rgba(255, 182, 207, .13) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.035),
          0 10px 28px rgba(255, 105, 155, .025);
      }

      #cardTrafficStats > div:nth-of-type(2) > div:hover,
      #trafficLast7:hover,
      #trafficTopPages:hover {
        border-color: rgba(255, 182, 207, .18) !important;
      }
    `;

    document.head.appendChild(style);
  }

  onDomReady(async function () {
    try {
      await loadAdminCore();
    } catch (err) {
      console.error("AIVO admin core failed to load:", err);
      return;
    }

    injectPushImageUploader();
    installIosSalesDailyReportFix();
    installTrafficSoftPinkStyle();
  });
})();