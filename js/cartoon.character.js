(() => {
  if (window.__CARTOON_CHARACTER_BIND__) return;
  window.__CARTOON_CHARACTER_BIND__ = true;

  const qs = (sel, root = document) => root.querySelector(sel);

  function getCartoonRoot() {
    return qs('.main-panel[data-module="cartoon"]');
  }

  function getBasicState() {
    return (window.__CARTOON_BASIC_STATE__ = window.__CARTOON_BASIC_STATE__ || {
      mode: "basic",
      extraPrompt: "",
      mainCharacter: "red-fish",
      helpers: [],
      scene: "underwater",
      action: "swimming",
      duration: "5",
      ratio: "16:9",
      audioEnabled: false,
      characterImage: null,
      characterImageName: "",
      characters: [],
      characterCreatePending: false,
      characterReferenceImageUrl: "",
      characterImageUrl: "",
      characterImageUploadPromise: null,
      characterImageUploadStatus: "idle",
      characterImageUploadError: "",
      isGenerating: false,
      activeBasicJobId: "",
      activeBasicPollToken: 0,
      selectedCreatedCharacterId: ""
    });
  }

  async function presignCartoonReference(file) {
    const res = await fetch("/api/r2/presign-put", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "cartoon",
        kind: "reference",
        filename: file?.name || `reference-${Date.now()}.png`,
        contentType: file?.type || "application/octet-stream"
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || "cartoon_reference_presign_failed");
    }

    return {
      uploadUrl: data.uploadUrl || data.upload_url,
      publicUrl: data.publicUrl || data.public_url || data.url || "",
    };
  }

  async function uploadCartoonReferenceToR2(file) {
    if (!file) throw new Error("missing_reference_file");

    const { uploadUrl, publicUrl } = await presignCartoonReference(file);

    if (!uploadUrl || !publicUrl) {
      throw new Error("cartoon_reference_missing_upload_urls");
    }

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!put.ok) {
      throw new Error("cartoon_reference_r2_put_failed");
    }

    return publicUrl;
  }

  function buildCharacterCreatePayload(root) {
    const state = getBasicState();

    const typeEl =
      root.querySelector("#cartoon-character-type") ||
      root.querySelector("[data-character-type]");

    const nameEl =
      root.querySelector("#cartoon-character-name") ||
      root.querySelector("[data-character-name]");

    const descEl =
      root.querySelector("#cartoon-character-desc") ||
      root.querySelector("[data-character-desc]");

    const styleEl =
      root.querySelector("#cartoon-character-style") ||
      root.querySelector("[data-character-style]");

    const fileEl =
      root.querySelector("[data-character-create-upload]");

    const hairTypeEl = root.querySelector("[data-character-hair-type]");
    const hairColorEl = root.querySelector("[data-character-hair-color]");
    const outfitEl = root.querySelector("[data-character-outfit]");
    const glassesEl = root.querySelector("[data-character-glasses]");
    const accessoryEl = root.querySelector("[data-character-accessory]");
    const expressionEl = root.querySelector("[data-character-expression]");

    const payload = {
      mode: "character",
      type: (typeEl?.value || "").trim(),
      name: (nameEl?.value || "").trim(),
      prompt: (descEl?.value || "").trim(),
      style: (styleEl?.value || "").trim(),
      hairType: (hairTypeEl?.value || "").trim(),
      hairColor: (hairColorEl?.value || "").trim(),
      outfit: (outfitEl?.value || "").trim(),
      glasses: (glassesEl?.value || "").trim(),
      accessory: (accessoryEl?.value || "").trim(),
      expression: (expressionEl?.value || "").trim(),
      referenceFile: fileEl?.files?.[0] || null,
      referenceImageUrl: state.characterReferenceImageUrl || ""
    };

    payload.uiState = {
      name: payload.name || "",
      type: payload.type || "",
      style: payload.style || "",
      prompt: payload.prompt || "",
      hairType: payload.hairType || "",
      hairColor: payload.hairColor || "",
      outfit: payload.outfit || "",
      glasses: payload.glasses || "",
      accessory: payload.accessory || "",
      expression: payload.expression || ""
    };

    return payload;
  }

  async function pollCartoonCharacterJob(jobId, tries = 0) {
    try {
      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(jobId)}&debug=1`);
      const j2 = await r.json().catch(() => null);

      console.log("[CARTOON][CHARACTER] poll =", j2);

      if (!j2 || j2.ok === false) {
        if (tries < 60) {
          setTimeout(() => pollCartoonCharacterJob(jobId, tries + 1), 3000);
        }
        return;
      }

      const normalizedStatus = String(
        j2?.status ||
        j2?.db_status ||
        j2?.state ||
        ""
      ).trim().toLowerCase();

      const readyImageUrl = String(
        j2?.image?.url ||
        j2?.image_url ||
        ""
      ).trim();

      const hasReadyImageOutput =
        Array.isArray(j2?.outputs) &&
        j2.outputs.some((o) => {
          const t = String(o?.type || o?.kind || o?.meta?.type || "").trim().toLowerCase();
          const u = String(o?.url || o?.image_url || "").trim();
          return !!u && t === "image";
        });

      if (
        ["ready", "completed", "complete", "succeeded", "done"].includes(normalizedStatus) &&
        (readyImageUrl || hasReadyImageOutput)
      ) {
        window.dispatchEvent(
          new CustomEvent("aivo:cartoon:job_ready", {
            detail: {
              job_id: jobId,
              status: normalizedStatus,
              mode: "character",
              image: readyImageUrl ? { url: readyImageUrl } : null,
              outputs: j2.outputs || [],
              raw: j2
            }
          })
        );
        return;
      }

      if (normalizedStatus === "error") {
        console.error("[CARTOON][CHARACTER] job error =", j2);
        return;
      }

      if (tries < 60) {
        setTimeout(() => pollCartoonCharacterJob(jobId, tries + 1), 3000);
      }
    } catch (err) {
      console.error("[CARTOON][CHARACTER] poll error =", err);

      if (tries < 60) {
        setTimeout(() => pollCartoonCharacterJob(jobId, tries + 1), 3000);
      }
    }
  }

  document.addEventListener("change", async (e) => {
    const root = getCartoonRoot();
    if (!root) return;

    const state = getBasicState();

    const characterCreateUpload = e.target.closest("[data-character-create-upload]");
    if (!characterCreateUpload || !root.contains(characterCreateUpload)) return;

    const file =
      characterCreateUpload.files && characterCreateUpload.files[0]
        ? characterCreateUpload.files[0]
        : null;

    if (!file) {
      state.characterReferenceImageUrl = "";
      return;
    }

    state.characterReferenceImageUrl = "";

    try {
      const publicUrl = await uploadCartoonReferenceToR2(file);
      state.characterReferenceImageUrl = String(publicUrl || "").trim();
      console.log("[CARTOON][REFERENCE_UPLOAD_OK]", state.characterReferenceImageUrl);
    } catch (err) {
      state.characterReferenceImageUrl = "";
      console.error("[CARTOON][REFERENCE_UPLOAD_ERROR]", err);
      alert(String(err?.message || err || "reference_upload_failed"));
    }
  });

  document.addEventListener("click", async (e) => {
    const root = getCartoonRoot();
    if (!root) return;

    const state = getBasicState();

    const characterCreateBtn = e.target.closest("[data-cartoon-character-create]");
    if (!characterCreateBtn || !root.contains(characterCreateBtn)) return;

    e.preventDefault();

    const payload = buildCharacterCreatePayload(root);
    console.log("[CARTOON][CHARACTER] payload =", payload);

    state.characterCreatePending = true;
    characterCreateBtn.disabled = true;
    characterCreateBtn.textContent = "Üretiliyor...";

    fetch("/api/providers/fal/cartoon/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        console.log("[CARTOON][CHARACTER] create response =", j);

        if (!r.ok || !j || j.ok === false) {
          throw new Error(j?.error || `character_create_failed_${r.status}`);
        }

        if (j?.job_id) {
          window.dispatchEvent(
            new CustomEvent("aivo:cartoon:job_created", {
              detail: {
                app: "cartoon",
                mode: "character",
                job_id: j.job_id,
                prompt: payload.prompt || "",
                createdAt: Date.now(),
                meta: {
                  app: "cartoon",
                  mode: "character",
                  provider: "fal",
                  name: payload.name || "",
                  type: payload.type || "",
                  style: payload.style || "",
                  prompt: payload.prompt || "",
                  ui_state: payload.uiState || {}
                }
              }
            })
          );

          pollCartoonCharacterJob(j.job_id, 0);
        }
      })
      .catch((err) => {
        state.characterCreatePending = false;
        characterCreateBtn.disabled = false;
        characterCreateBtn.textContent = "🧩 Karakter Oluştur";

        console.error("[CARTOON][CHARACTER] create error:", err);
        alert(String(err?.message || err || "character_create_failed"));
      });
  });

  window.addEventListener("aivo:cartoon:job_ready", (e) => {
    const d = e?.detail || {};
    const raw = d?.raw || {};
    const root = getCartoonRoot();
    const state = getBasicState();

    const mode = String(
      d?.mode ||
      d?.raw?.mode ||
      d?.raw?.meta?.mode ||
      ((d?.image?.url || d?.raw?.image?.url) ? "character" : "")
    ).trim().toLowerCase();

    const imageUrl = String(
      d?.image?.url ||
      d?.raw?.image?.url ||
      ""
    ).trim();

    if (mode !== "character" || !imageUrl) return;

    const fallbackName = qs("#cartoon-character-name", root)?.value || "";
    const fallbackStyle = qs("#cartoon-character-style", root)?.value || "";

    const nextItem = {
      id: String(d.job_id || `character_${Date.now()}`),
      job_id: String(d.job_id || ""),
      name: String(
        raw?.meta?.name ||
        raw?.name ||
        raw?.meta?.ui_state?.name ||
        raw?.ui_state?.name ||
        fallbackName ||
        "Karakter"
      ).trim(),
      type: String(raw?.meta?.type || raw?.type || "").trim(),
      style: String(
        raw?.meta?.style ||
        raw?.style ||
        raw?.meta?.ui_state?.style ||
        raw?.ui_state?.style ||
        fallbackStyle ||
        ""
      ).trim(),
      prompt: String(raw?.meta?.prompt || raw?.prompt || "").trim(),
      uiState: {
        name:
          raw?.meta?.ui_state?.name ||
          raw?.ui_state?.name ||
          qs("#cartoon-character-name", root)?.value ||
          "",
        type:
          raw?.meta?.ui_state?.type ||
          raw?.ui_state?.type ||
          qs("#cartoon-character-type", root)?.value ||
          "",
        style:
          raw?.meta?.ui_state?.style ||
          raw?.ui_state?.style ||
          qs("#cartoon-character-style", root)?.value ||
          "",
        prompt:
          raw?.meta?.ui_state?.prompt ||
          raw?.ui_state?.prompt ||
          qs("#cartoon-character-desc", root)?.value ||
          "",
        hairType:
          raw?.meta?.ui_state?.hairType ||
          raw?.ui_state?.hairType ||
          qs("[data-character-hair-type]", root)?.value ||
          "",
        hairColor:
          raw?.meta?.ui_state?.hairColor ||
          raw?.ui_state?.hairColor ||
          qs("[data-character-hair-color]", root)?.value ||
          "",
        outfit:
          raw?.meta?.ui_state?.outfit ||
          raw?.ui_state?.outfit ||
          qs("[data-character-outfit]", root)?.value ||
          "",
        glasses:
          raw?.meta?.ui_state?.glasses ||
          raw?.ui_state?.glasses ||
          qs("[data-character-glasses]", root)?.value ||
          "",
        accessory:
          raw?.meta?.ui_state?.accessory ||
          raw?.ui_state?.accessory ||
          qs("[data-character-accessory]", root)?.value ||
          "",
        expression:
          raw?.meta?.ui_state?.expression ||
          raw?.ui_state?.expression ||
          qs("[data-character-expression]", root)?.value ||
          ""
      },
      imageUrl
    };

    const exists = (state.characters || []).some(
      (x) => String(x.job_id || x.id) === String(nextItem.job_id || nextItem.id)
    );

    if (!exists) {
      state.characters = [nextItem, ...(state.characters || [])];
    }

    state.characterCreatePending = false;

    const createBtn = root?.querySelector("[data-cartoon-character-create]");
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.textContent = "🧩 Karakter Oluştur";
    }
  });
})();
