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

            const removePhotoBtn = e.target.closest("[data-lipsync-photo-remove]");
      if (removePhotoBtn && root.contains(removePhotoBtn)) {
        e.preventDefault();
        e.stopPropagation();

        const photoInput = qs("[data-lipsync-photo]", root);
        const photoLabel = qs(".lipsync-photo-label", root);
        const empty = qs("[data-lipsync-photo-empty]", root);
        const preview = qs("[data-lipsync-photo-preview]", root);
        const name = qs("[data-lipsync-photo-name]", root);

        if (photoInput) photoInput.value = "";

        if (preview) {
          preview.removeAttribute("src");
          preview.style.display = "none";
        }

        if (name) {
          name.textContent = "";
          name.style.display = "none";
        }

        if (empty) empty.style.display = "";

        if (photoLabel) {
          photoLabel.classList.remove("has-photo-bg", "is-landscape", "is-portrait");
          photoLabel.style.removeProperty("--lipsync-photo-bg");
        }

        console.log("[LIPSYNC][PHOTO_REMOVED]");
        return;
      }
      

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

      generateBtn.disabled = true;
      generateBtn.textContent = "Lipsync job hazırlanıyor...";

      fetch("/api/lipsync/create", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);

          if (!res.ok || !data || data.ok !== true) {
            throw new Error(data?.error || "lipsync_create_failed");
          }

          console.log("[LIPSYNC][CREATE_OK]", data);

          try {
            window.toast?.success?.("Lipsync job oluşturuldu");
          } catch {}

          const jobId = String(data.job_id || "").trim();

          if (!jobId) {
            throw new Error("missing_lipsync_job_id");
          }

          window.dispatchEvent(
            new CustomEvent("aivo:lipsync:job_created", {
              detail: {
                app: "lipsync",
                job_id: jobId,
                status: data.status || "queued",
                createdAt: Date.now(),
                meta: {
                  app: "lipsync",
                  script: payload.script,
                  resolution: payload.resolution,
                  duration: payload.duration,
                  estimatedCredits: payload.estimatedCredits
                }
              }
            })
          );

          let tries = 0;

          const poll = async () => {
            tries += 1;

            try {
              const statusRes = await fetch(
                "/api/jobs/status?job_id=" + encodeURIComponent(jobId) + "&debug=1",
                {
                  method: "GET",
                  cache: "no-store"
                }
              );

              const statusData = await statusRes.json().catch(() => null);

              console.log("[LIPSYNC][STATUS]", statusData);

              const status = String(
                statusData?.status ||
                statusData?.db_status ||
                statusData?.state ||
                ""
              ).trim().toLowerCase();

              const isReady =
                status === "ready" ||
                status === "done" ||
                status === "completed" ||
                status === "complete" ||
                status === "succeeded";

              const isFailed =
                status === "error" ||
                status === "failed" ||
                status === "fail";

              if (isReady) {
                window.dispatchEvent(
                  new CustomEvent("aivo:lipsync:job_ready", {
                    detail: {
                      app: "lipsync",
                      job_id: jobId,
                      status,
                      raw: statusData
                    }
                  })
                );

                try {
                  window.toast?.success?.("Lipsync video hazır");
                } catch {}

                return;
              }

              if (isFailed) {
                window.dispatchEvent(
                  new CustomEvent("aivo:lipsync:job_failed", {
                    detail: {
                      app: "lipsync",
                      job_id: jobId,
                      status,
                      raw: statusData
                    }
                  })
                );

                try {
                  window.toast?.error?.("Lipsync üretimi başarısız oldu");
                } catch {}

                return;
              }

              if (tries < 60) {
                setTimeout(poll, 3000);
              }
            } catch (pollErr) {
              console.error("[LIPSYNC][STATUS_ERROR]", pollErr);

              if (tries < 60) {
                setTimeout(poll, 3000);
              }
            }
          };

          poll();

          return data;
        })
        .catch((err) => {
          console.error("[LIPSYNC][CREATE_ERROR]", err);

          try {
            window.toast?.error?.("Lipsync job oluşturulamadı");
          } catch {}
        })
        .finally(() => {
          syncGenerateButton(root);
          generateBtn.disabled = false;
        });
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
