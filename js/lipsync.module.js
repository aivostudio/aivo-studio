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

  const scriptInput = qs("[data-lipsync-script]", root);
  const text = String(scriptInput?.value || "").trim();

  const charsPerSecond = 13;
  const seconds = Math.max(1, Math.ceil(text.length / charsPerSecond));
  const credit = Math.ceil(seconds / 2) * 3;

  btn.dataset.creditCost = String(credit);
  btn.textContent = `Dudak Senkron Video Üret (${credit} Kredi)`;
}

  function buildPayload(root) {
    const script = qs("[data-lipsync-script]", root);
    const resolution = qs("[data-lipsync-resolution]", root);
    const duration = getSelectedDuration(root);
    const credit = getCreditCost(duration);

    const aspectEl =
      qs("[data-lipsync-aspect].is-active", root) ||
      qs("[data-lipsync-aspect][aria-pressed='true']", root) ||
      qs('input[name="lipsyncAspect"]:checked', root);

    const aspectRatio = String(
      aspectEl?.dataset?.lipsyncAspect ||
      aspectEl?.value ||
      "16:9"
    ).trim();

    const voiceBtn =
    const voiceSelect = qs("[data-lipsync-voice-select]", root);
    const selectedOption = voiceSelect?.selectedOptions?.[0] || null;

    const voiceBtn =
      qs("[data-lipsync-voice].is-active", root) ||
      qs("[data-lipsync-voice]", root);

    const voiceKey = String(
      voiceSelect?.value ||
      voiceBtn?.dataset?.lipsyncVoice ||
      "tranquil_tulin"
    ).trim();

    const voiceName = String(
      selectedOption?.dataset?.voiceName ||
      voiceBtn?.dataset?.lipsyncVoiceName ||
      voiceBtn?.textContent ||
      "Tranquil Tülin"
    )
      .replace("🔊", "")
      .trim();

    return {
      app: "lipsync",
      script: String(script?.value || "").trim(),
      resolution: String(resolution?.value || "1080p"),
      duration,
      aspectRatio,
      aspect_ratio: aspectRatio,
      voice_key: voiceKey,
      voice_name: voiceName,
      estimatedCredits: credit
    };
  }

  async function uploadLipsyncPhotoToR2(file, payload) {
    if (!file) {
      throw new Error("lipsync_missing_photo_file");
    }

    const filename = file.name || `lipsync-photo-${Date.now()}.jpg`;
    const contentType = file.type || "application/octet-stream";
    const promptText = String(payload?.script || "").trim();

    const presignRes = await fetch("/api/r2/scan-and-presign", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        app: "lipsync",
        kind: "image",
        filename,
        contentType,
        prompt: promptText,
        title: filename,
        description: promptText || filename,
        personName: "",
        style: "",
        source: "lipsync_browser_photo_upload"
      })
    });

    const presignData = await presignRes.json().catch(() => null);

    if (!presignRes.ok || !presignData || presignData.ok === false) {
      throw new Error(presignData?.message || presignData?.error || "lipsync_presign_failed");
    }

    const uploadUrl = presignData.uploadUrl || presignData.upload_url || "";
    const publicUrl = presignData.publicUrl || presignData.public_url || presignData.url || "";
    const key = presignData.key || presignData.objectKey || "";

    if (!uploadUrl || !publicUrl || !key) {
      throw new Error("lipsync_presign_invalid");
    }

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": contentType
      },
      body: file
    });

    if (!putRes.ok) {
      throw new Error(`lipsync_r2_put_failed_${putRes.status}`);
    }

    const scanRes = await fetch("/api/r2/scan-upload", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        app: "lipsync",
        key,
        filename,
        contentType,
        public_url: publicUrl,
        prompt: promptText,
        title: filename,
        description: promptText || filename,
        personName: "",
        style: "",
        source: "lipsync_browser_photo_upload"
      })
    });

    const scanData = await scanRes.json().catch(() => null);

    if (!scanRes.ok || !scanData || scanData.ok === false) {
      throw new Error(scanData?.message || scanData?.error || "lipsync_scan_upload_failed");
    }

    if (scanData.decision && scanData.decision !== "allow") {
      throw new Error(`media_policy_${scanData.decision}`);
    }

    return String(scanData.public_url || publicUrl || "").trim();
  }

  function bindEvents() {
    document.addEventListener("change", (e) => {
document.addEventListener("input", (e) => {
  const root = getRoot();
  if (!root) return;

  const scriptInput = e.target.closest("[data-lipsync-script]");
  if (!scriptInput || !root.contains(scriptInput)) return;

  const text = String(scriptInput.value || "");
  const trimmedText = text.trim();
  const duration = Number(getSelectedDuration(root) || 10);

  const charsPerSecond = 13;
  const seconds = Math.max(1, Math.ceil(trimmedText.length / charsPerSecond));
  const credits = Math.ceil(seconds / 2) * 3;

  const counterEl = qs("[data-lipsync-counter]", root);
  if (counterEl) {
    counterEl.textContent = `${text.length} / 1200`;
  }

  let infoEl = qs("[data-lipsync-estimate]", root);

  if (!infoEl) {
    infoEl = document.createElement("div");
   infoEl.setAttribute("data-lipsync-estimate", "1");
   infoEl.className = "lipsync-estimate-box";
    infoEl.style.fontSize = "12px";
    infoEl.style.marginTop = "6px";
    infoEl.style.opacity = "0.8";

    scriptInput.parentNode.appendChild(infoEl);
  }

  infoEl.textContent = `Tahmini: ${seconds} sn • ${credits} kredi`;

  if (seconds > duration) {
    infoEl.style.color = "#ff4d4f";
  } else {
    infoEl.style.color = "";
  }

  syncGenerateButton(root);
});
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
           const voiceSelect = e.target.closest("[data-lipsync-voice-select]");
      if (voiceSelect && root.contains(voiceSelect)) {
        const selectedVoiceKey = String(voiceSelect.value || "tranquil_tulin").trim();

        root.querySelectorAll("[data-lipsync-voice]").forEach((btn) => {
          const isSelected = String(btn.dataset.lipsyncVoice || "").trim() === selectedVoiceKey;
          btn.classList.toggle("is-active", isSelected);
          btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
        });

        console.log("[LIPSYNC][VOICE_SELECT_CHANGED]", {
          voice_key: selectedVoiceKey,
          voice_name: voiceSelect.selectedOptions?.[0]?.dataset?.voiceName || ""
        });

        return;
      }
      const durationSelect = e.target.closest("[data-lipsync-duration]");
      if (!durationSelect || !root.contains(durationSelect)) return;

      syncGenerateButton(root);
    });

     document.addEventListener("click", async (e) => {
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
      
             const voiceBtn = e.target.closest("[data-lipsync-voice]");
      if (voiceBtn && root.contains(voiceBtn)) {
        e.preventDefault();

        root.querySelectorAll("[data-lipsync-voice]").forEach((btn) => {
          btn.classList.remove("is-active");
          btn.setAttribute("aria-pressed", "false");
        });

        voiceBtn.classList.add("is-active");
        voiceBtn.setAttribute("aria-pressed", "true");

        console.log("[LIPSYNC][VOICE_SELECTED]", {
          voice_key: voiceBtn.dataset.lipsyncVoice || "",
          voice_name: voiceBtn.dataset.lipsyncVoiceName || ""
        });

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
      const charsPerSecond = 13;
const estimatedSpeechSeconds = Math.max(1, Math.ceil(payload.script.length / charsPerSecond));
const maxSpeechSeconds = Number(payload.duration || 10);
const estimatedCreditCost = Math.ceil(estimatedSpeechSeconds / 2) * 3;

payload.estimatedSpeechSeconds = estimatedSpeechSeconds;
payload.estimatedCredits = estimatedCreditCost;

       if (estimatedSpeechSeconds > maxSpeechSeconds) {
        try {
       window.toast?.error?.(
      `Bu metin yaklaşık ${estimatedSpeechSeconds} saniye sürer. Seçilen süre ${maxSpeechSeconds} saniye.`
      );
       } catch {}

  console.log("[LIPSYNC][BLOCKED]", {
    reason: "script_too_long",
    estimatedSpeechSeconds,
    maxSpeechSeconds
  });

  return;
}
         const photoInput = qs("[data-lipsync-photo]", root);
      const photoFile = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;

      if (!photoFile) {
        try { window.toast?.info?.("Fotoğraf yüklemelisin"); } catch {}
        const photoLabel = qs(".lipsync-photo-label", root);
        if (photoLabel) photoLabel.scrollIntoView({ behavior: "smooth", block: "center" });
        console.log("[LIPSYNC][BLOCKED]", "missing_photo");
        return;
      }

      let imageUrl = "";

      try {
        generateBtn.disabled = true;
        generateBtn.textContent = "Fotoğraf yükleniyor...";

        imageUrl = await uploadLipsyncPhotoToR2(photoFile, payload);

        if (!imageUrl) {
          throw new Error("lipsync_photo_url_missing");
        }

        payload.image_url = imageUrl;
        payload.imageUrl = imageUrl;

        console.log("[LIPSYNC][PHOTO_R2_OK]", imageUrl);
      } catch (uploadErr) {
        console.error("[LIPSYNC][PHOTO_R2_ERROR]", uploadErr);

        try {
          window.toast?.error?.("Fotoğraf yüklenemedi");
        } catch {}

        syncGenerateButton(root);
        generateBtn.disabled = false;
        return;
      }
     const creditCost = Number(payload.estimatedCredits || 3);
      const creditReason = "studio_lipsync_generate";
      const consumeRequestId = `lipsync:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      const creditRes = await fetch("/api/credits/consume-ledger", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          app: "lipsync",
          action: creditReason,
          cost: creditCost,
          request_id: consumeRequestId,
          reason: creditReason
        })
      });

      const creditData = await creditRes.json().catch(() => null);

      if (!creditRes.ok || !creditData || creditData.ok !== true) {
        console.warn("[LIPSYNC][CREDIT_BLOCKED]", creditData);

        try {
          window.toast?.error?.("Yetersiz kredi");
        } catch {}

        return;
      }

      try {
        const creditGetRes = await fetch("/api/credits/get", {
          credentials: "include",
          cache: "no-store",
          headers: {
            "accept": "application/json"
          }
        });

        const creditGetData = await creditGetRes.json().catch(() => null);

        if (creditGetData?.ok && typeof creditGetData.credits === "number") {
          const topCreditCountEl = document.getElementById("topCreditCount");
          if (topCreditCountEl) {
            topCreditCountEl.textContent = String(creditGetData.credits);
          }

          if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
            window.AIVO_STORE_V1.setCredits(creditGetData.credits);
          }
        }
      } catch {}

      try {
        window.toast?.success?.(`${creditCost} kredi düşüldü`);
      } catch {}
     generateBtn.disabled = true;
     generateBtn.textContent = "Video hazırlanıyor...";

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
      if (data?.error === "script_too_long") {
         const message = String(
      data?.message ||
      "Bu metin seçilen süre için çok uzun. Lütfen daha kısa yaz veya daha uzun süre seç."
    );

        try {
      window.toast?.error?.(message);
          } catch {}

         throw new Error("script_too_long_handled");
         }

         throw new Error(data?.error || "lipsync_create_failed");
         }

          console.log("[LIPSYNC][CREATE_OK]", data);

         try {
        window.toast?.success?.("Video oluşturuldu");
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
             if (String(statusData?.status || "").toLowerCase() === "ready") {
               window.dispatchEvent(new CustomEvent("aivo:lipsync:job_ready", {
              detail: {
      job_id: statusData.job_id,
      app: "lipsync",
      video: statusData.video || null,
      outputs: statusData.outputs || [],
      raw: statusData
      }
     }));
    }
              const status = String(
                statusData?.status ||
                statusData?.db_status ||
                ""
              ).trim().toLowerCase();

            if (status === "ready" || status === "done") {

  try {
    window.toast?.success?.("Lipsync video hazır");
  } catch {}

  // 🔥 FINALIZE CALL
  try {
    await fetch("/api/lipsync/finalize", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        job_id: jobId
      })
    });

    console.log("[LIPSYNC][FINALIZE_TRIGGERED]", jobId);
  } catch (e) {
    console.error("[LIPSYNC][FINALIZE_ERROR]", e);
  }

  return;
}

              if (status === "error") {
                try {
                  window.toast?.error?.("Lipsync üretimi başarısız oldu");
                } catch {}
                return;
              }

              if (tries < 80) {
                setTimeout(poll, 5000);
              }
            } catch (err) {
              console.error("[LIPSYNC][STATUS_ERROR]", err);

              if (tries < 80) {
                setTimeout(poll, 5000);
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
