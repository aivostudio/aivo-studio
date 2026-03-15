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

  async function pollCartoonJob(jobId, tries = 0, pollToken = 0) {
    const state = getBasicState();

    try {
      const activeJobId = String(state.activeBasicJobId || "").trim();
      const activePollToken = Number(state.activeBasicPollToken || 0);
      const currentJobId = String(jobId || "").trim();

      if (activeJobId && activeJobId !== currentJobId) return;
      if (pollToken && activePollToken && pollToken !== activePollToken) return;

      const r = await fetch(
        `/api/jobs/status?job_id=${encodeURIComponent(jobId)}&debug=1`
      );
      const j2 = await r.json().catch(() => null);

      console.log("[CARTOON][CHARACTER] poll =", j2);

      if (!j2 || j2.ok === false) {
        if (tries < 60) {
          setTimeout(() => pollCartoonJob(jobId, tries + 1, pollToken), 3000);
        }
        return;
      }

      const normalizedStatus = String(
        j2?.status ||
        j2?.db_status ||
        j2?.state ||
        ""
      ).trim().toLowerCase();

      const readyVideoUrl = String(
        j2?.video?.url ||
        j2?.video_url ||
        ""
      ).trim();

      const readyImageUrl = String(
        j2?.image?.url ||
        j2?.image_url ||
        ""
      ).trim();

      const readyMode = String(
        j2?.mode ||
        j2?.meta?.mode ||
        j2?.job?.mode ||
        ""
      ).trim().toLowerCase();

      const hasReadyOutput =
        Array.isArray(j2?.outputs) &&
        j2.outputs.some((o) => {
          const t = String(o?.type || o?.kind || o?.meta?.type || "").trim().toLowerCase();
          const u = String(o?.url || o?.image_url || o?.video_url || "").trim();
          return !!u && (t === "video" || t === "image");
        });

      if (
        ["ready", "completed", "complete", "succeeded", "done"].includes(normalizedStatus) &&
        (readyVideoUrl || readyImageUrl || hasReadyOutput)
      ) {
        window.__LAST_CARTOON_STATUS__ = j2;

        if (String(state.activeBasicJobId || "").trim() === currentJobId) {
          state.activeBasicJobId = "";
          state.activeBasicPollToken = 0;
        }

        window.dispatchEvent(
          new CustomEvent("aivo:cartoon:job_ready", {
            detail: {
              job_id: jobId,
              status: normalizedStatus,
              mode: readyMode,
              video: readyVideoUrl ? { url: readyVideoUrl } : null,
              image: readyImageUrl ? { url: readyImageUrl } : null,
              outputs: j2.outputs || [],
              raw: j2
            }
          })
        );
        return;
      }

      if (j2.status === "error") {
        console.error("[CARTOON][CHARACTER] job error =", j2);
        return;
      }

      if (tries < 60) {
        setTimeout(() => pollCartoonJob(jobId, tries + 1, pollToken), 3000);
      }
    } catch (err) {
      console.error("[CARTOON][CHARACTER] poll error =", err);

      if (tries < 60) {
        setTimeout(() => pollCartoonJob(jobId, tries + 1, pollToken), 3000);
      }
    }
  }

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

          pollCartoonJob(j.job_id, 0, 0);
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
})();
