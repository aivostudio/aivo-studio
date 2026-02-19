/* ============================================================================
   atmosphere.module.js — GENERATE PATCH (Cover/Video pattern)
   - Adds real "press + Üretiliyor..." behavior
   - Calls Fal create endpoint (app=atmo), then polls status (app=atmo)
   - On READY/COMPLETED extracts mp4 URL and PPE.apply() -> RightPanel item shows
   - Fixes super prompt counter id mismatch
   ============================================================================ */

(() => {
  // ---------- helpers ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const safeJson = async (res) => {
    try { return await res.json(); } catch { return null; }
  };

  function setBtnLoading(btn, loading, labelWhenLoading = "Üretiliyor...") {
    if (!btn) return;
    if (!btn.__origHTML) btn.__origHTML = btn.innerHTML;

    if (loading) {
      btn.disabled = true;
      btn.classList.add("is-loading");
      btn.setAttribute("aria-busy", "true");
      btn.innerHTML = labelWhenLoading;
    } else {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      btn.removeAttribute("aria-busy");
      btn.innerHTML = btn.__origHTML || btn.innerHTML;
    }
  }

  function pickVideoUrl(obj) {
    if (!obj) return null;

    // Common shapes (best-effort)
    const candidates = [
      obj?.video?.url,
      obj?.output?.video?.url,
      obj?.output?.url,
      obj?.result?.video?.url,
      obj?.result?.url,
      obj?.data?.video?.url,
      obj?.data?.output?.url,
      obj?.outputs?.find?.((x) => x?.type === "video")?.url,
      obj?.output?.find?.((x) => x?.type === "video")?.url,
      obj?.images?.[0]?.url, // sometimes misnamed but includes video url in some providers
    ].filter(Boolean);

    const url = candidates.find((u) => typeof u === "string" && u.startsWith("http"));
    return url || null;
  }

  function isDoneStatus(s) {
    const v = String(s || "").toLowerCase();
    return v === "completed" || v === "succeeded" || v === "success" || v === "ready" || v === "done";
  }
  function isFailStatus(s) {
    const v = String(s || "").toLowerCase();
    return v === "failed" || v === "error" || v === "canceled" || v === "cancelled";
  }

  // ---------- endpoints (adjust only here if needed) ----------
  const FAL_CREATE_URL = "/api/providers/fal/predictions/create?app=atmo";
  const FAL_STATUS_URL = "/api/providers/fal/predictions/status?app=atmo";

  async function falCreate(payload) {
    // If any File exists, send multipart. Otherwise JSON.
    const hasFile =
      payload?.image_file instanceof File ||
      payload?.logo_file instanceof File ||
      payload?.audio_file instanceof File ||
      payload?.ref_image_file instanceof File ||
      payload?.ref_audio_file instanceof File;

    let res, data;

    if (hasFile) {
      const fd = new FormData();
      fd.append("payload", JSON.stringify(payload));

      // attach files under stable keys (backend should read these)
      if (payload.image_file) fd.append("image_file", payload.image_file);
      if (payload.logo_file) fd.append("logo_file", payload.logo_file);
      if (payload.audio_file) fd.append("audio_file", payload.audio_file);
      if (payload.ref_image_file) fd.append("ref_image_file", payload.ref_image_file);
      if (payload.ref_audio_file) fd.append("ref_audio_file", payload.ref_audio_file);

      res = await fetch(FAL_CREATE_URL, { method: "POST", body: fd, credentials: "include" });
      data = await safeJson(res);
    } else {
      res = await fetch(FAL_CREATE_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include"
      });
      data = await safeJson(res);
    }

    if (!res.ok || !data) {
      const msg = data?.error || data?.message || `create_failed_${res.status}`;
      throw new Error(msg);
    }

    // normalize request id
    const requestId =
      data?.request_id ||
      data?.requestId ||
      data?.id ||
      data?.prediction_id ||
      data?.predictionId ||
      data?.data?.request_id ||
      null;

    return { raw: data, requestId };
  }

  async function falPoll(requestId, { timeoutMs = 4 * 60 * 1000, intervalMs = 1800 } = {}) {
    const t0 = Date.now();

    while (Date.now() - t0 < timeoutMs) {
      const url = `${FAL_STATUS_URL}&request_id=${encodeURIComponent(requestId)}`;
      const res = await fetch(url, { credentials: "include" });
      const data = await safeJson(res);

      if (!res.ok || !data) {
        // transient: keep polling a bit
        await sleep(intervalMs);
        continue;
      }

      const status =
        data?.status ||
        data?.state ||
        data?.data?.status ||
        data?.data?.state ||
        null;

      if (isFailStatus(status)) {
        const msg = data?.error || data?.message || "failed";
        throw new Error(msg);
      }

      if (isDoneStatus(status)) {
        const urlOut = pickVideoUrl(data);
        if (!urlOut) {
          // done but no url -> treat as error (don’t spend credits without output)
          throw new Error("completed_but_no_video_url");
        }
        return { raw: data, status, videoUrl: urlOut };
      }

      await sleep(intervalMs);
    }

    throw new Error("timeout_waiting_video");
  }

  // ---------- patch counter id mismatch ----------
  document.addEventListener("input", (e) => {
    const ta = e.target?.closest?.("#atmSuperPrompt");
    if (!ta) return;
    const root = ta.closest?.('.main-panel[data-module="atmosphere"]') || document;
    const counter = root.querySelector("#atmSuperPromptCount"); // ✅ correct id
    if (counter) counter.textContent = String((ta.value || "").length);
  });

  // ---------- integrate with your existing builder/state (expects buildBasicPayload/buildProPayload) ----------
  // If you already have these functions in your module, we’ll reuse them.
  // Otherwise we read from window.__ATM_V2__ like in your patch.
  function buildPayloadFromExisting(mode) {
    // Prefer existing functions if present
    if (typeof window.buildBasicPayload === "function" && typeof window.buildProPayload === "function") {
      return mode === "pro" ? window.buildProPayload() : window.buildBasicPayload();
    }

    // Fallback: minimal from state you created (window.__ATM_V2__)
    const s = window.__ATM_V2__ || {};
    if (mode === "pro") {
      return {
        app: "atmo",
        mode: "pro",
        prompt: s.prompt || "",
        light: s.light || null,
        mood: s.mood || null,
        ref_image_file: s.refImageFile || null,
        ref_audio_file: s.refAudioFile || null,
        fps: s.fps || "24",
        format: s.format || "mp4",
        seam_fix: !!s.seamFix,
        details: { ...(s.details || {}) }
      };
    }
    return {
      app: "atmo",
      mode: "basic",
      scene: s.scene || null,
      effects: (s.effects || []).slice(),
      camera: s.camera || "kenburns_soft",
      duration: s.duration || "8",
      image_file: s.imageFile || null,
      logo_file: s.logoFile || null,
      logo_pos: s.logoPos || "br",
      logo_size: s.logoSize || "sm",
      logo_opacity: s.logoOpacity ?? 0.9,
      audio_file: s.audioFile || null,
      audio_mode: s.audioMode || "none",
      audio_trim: s.audioTrim || "loop_to_fit",
      silent_copy: !!s.silentCopy
    };
  }

  async function generateAtmo(btn) {
    const mode = btn?.dataset?.atmMode || btn?.getAttribute?.("data-atm-mode") || "basic";
    const payload = buildPayloadFromExisting(mode);

    console.debug("[ATM] generate payload =", payload);

    // UX: press feel like cover/video
    setBtnLoading(btn, true, "Üretiliyor...");
    await sleep(250); // tiny “pressed” feel

    // 1) create
    const { requestId, raw: createRaw } = await falCreate(payload);
    if (!requestId) {
      console.warn("[ATM] create response =", createRaw);
      throw new Error("missing_request_id");
    }

    // Optional: announce processing to UI if you have PPE + panel supports “PROCESSING”
    if (window.PPE?.apply) {
      try {
        window.PPE.apply({
          state: "PROCESSING",
          outputs: [
            {
              type: "video",
              url: null,
              // meta helps the panel filter
              meta: { app: "atmo", mode, request_id: requestId }
            }
          ]
        });
      } catch {}
    }

    // 2) poll
    const done = await falPoll(requestId);

    // 3) apply to RightPanel
    if (window.PPE?.apply) {
      window.PPE.apply({
        state: "COMPLETED",
        outputs: [
          {
            type: "video",
            url: done.videoUrl,
            meta: { app: "atmo", mode, request_id: requestId }
          }
        ]
      });
    } else {
      console.log("[ATM] video ready =", done.videoUrl);
    }

    return done;
  }

  // ---------- bind (delegated) ----------
  document.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("[data-atm-generate]");
    if (!btn) return;

    // keep router-safe: only inside atmosphere panel
    const panel = btn.closest?.('.main-panel[data-module="atmosphere"]');
    if (!panel) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      await generateAtmo(btn);
      // keep the “cover/video feel”: show it busy a bit longer
      await sleep(900);
      setBtnLoading(btn, false);
    } catch (err) {
      console.error("[ATM] generate failed:", err);
      setBtnLoading(btn, false);

      // if you have toast helper, use it
      if (window.toast?.error) window.toast.error("Atmosfer üretim başarısız: " + (err?.message || "error"));
      else if (window.Toast?.error) window.Toast.error("Atmosfer üretim başarısız");
    }
  }, true);
})();
