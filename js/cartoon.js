(() => {
  if (window.__CARTOON_BASIC_BIND__) return;
  window.__CARTOON_BASIC_BIND__ = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getCartoonRoot() {
    return qs('.main-panel[data-module="cartoon"]');
  }

  const state = (window.__CARTOON_BASIC_STATE__ = window.__CARTOON_BASIC_STATE__ || {
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
   characters: []
  });

  function getEstimatedCredits() {
    const durationNum = Number(state.duration || 5);
    if (durationNum <= 5) return 10;
    if (durationNum <= 10) return 20;
    return 30;
  }

  function updatePromptCount(root) {
    const input = qs("[data-cartoon-prompt-input]", root);
    const out = qs("[data-cartoon-prompt-count]", root);
    if (!input || !out) return;

    const len = String(input.value || "").length;
    out.textContent = `${len} / 1000`;
  }

  function updateHelperCount(root) {
    const el = qs("[data-helper-count]", root);
    if (!el) return;
    el.textContent = `${state.helpers.length}/3`;
  }

  function updateUploadText(root) {
    const textEl = qs(".cartoon-upload-text", root);
    if (!textEl) return;
    textEl.textContent = state.characterImageName || "Dosya seçilmedi";
  }

  function updateSummary(root) {
    const el = qs("[data-cartoon-summary]", root);
    if (!el) return;

    const durationText = `${state.duration} sn`;
    const mainCountText = state.mainCharacter ? "1 ana karakter" : "0 ana karakter";
    const helperCountText = `${state.helpers.length} yardımcı`;
    const creditText = `${getEstimatedCredits()} kredi`;

    el.textContent = `${durationText} • ${mainCountText} • ${helperCountText} • ${creditText}`;
  }

  function syncMainSelection(root) {
    qsa('[data-role="main"]', root).forEach((btn) => {
      const on = btn.dataset.character === state.mainCharacter;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncHelperSelection(root) {
    qsa('[data-role="helper"]', root).forEach((btn) => {
      const on = state.helpers.includes(btn.dataset.character);
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncSceneSelection(root) {
    qsa("[data-scene]", root).forEach((btn) => {
      const on = btn.dataset.scene === state.scene;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

 function syncActionSelection(root) {
  qsa("[data-action]", root).forEach((btn) => {
    const on = btn.dataset.action === state.action;
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function syncModeTabs(root) {
  qsa("[data-cartoon-mode]", root).forEach((btn) => {
    const on = btn.dataset.cartoonMode === state.mode;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
}
function syncModeViews(root) {
  qsa(".cartoon-mode-view[data-cartoon-view]", root).forEach((el) => {
    const view = el.dataset.cartoonView || "";
    const on = view === state.mode;
    el.hidden = !on;
    el.classList.toggle("is-active", on);
  });
}

function syncFormValues(root) {
  const prompt = qs("[data-cartoon-prompt-input]", root);
  const duration = qs("#cartoon-duration", root);
  const ratio = qs("#cartoon-ratio", root);
  const audio = qs("[data-audio-enabled]", root);

  if (prompt && prompt.value !== state.extraPrompt) prompt.value = state.extraPrompt;
  if (duration && duration.value !== state.duration) duration.value = state.duration;
  if (ratio && ratio.value !== state.ratio) ratio.value = state.ratio;
  if (audio) audio.checked = !!state.audioEnabled;
}
function renderCharacterLibrary(root) {
  const host =
    qs("[data-cartoon-character-library]", root) ||
    qs("[data-cartoon-characters]", root) ||
    qs("[data-character-library]", root);

  if (!host) return;

  const items = Array.isArray(state.characters) ? state.characters : [];

  if (!items.length) {
    host.innerHTML = `<div class="cpEmpty">Henüz karakter yok.</div>`;
    return;
  }

  host.innerHTML = `
   <div class="cpGrid" style="display:grid;grid-template-columns:repeat(5,112px);justify-content:start;gap:10px;max-height:236px;overflow-y:auto;overflow-x:hidden;align-content:start;padding-right:4px;">
      ${items.map((item) => {
        const itemId = String(item.id || item.job_id || "");
        const imageUrl = String(item.imageUrl || "").trim();
        const name = String(item.name || "Karakter").trim();
        const isSelected =
          String(state.selectedCreatedCharacterId || "") === itemId;

        return `
          <div
            class="cpCard ${isSelected ? "is-selected" : ""}"
            data-character-id="${itemId.replace(/"/g, "&quot;")}"
            tabindex="0"
            style="padding:6px;border-radius:12px;position:relative;"
          >
            <div
              class="cpThumb"
              data-act="open"
              data-character-id="${itemId.replace(/"/g, "&quot;")}"
              title="Önizle"
              style="aspect-ratio:1/1;width:100%;max-width:92px;position:relative;border-radius:10px;margin:0 auto;overflow:hidden;cursor:pointer;"
            >
              <img
                src="${imageUrl.replace(/"/g, "&quot;")}"
                alt="${name.replace(/"/g, "&quot;")}"
                style="width:100%;height:100%;object-fit:cover;display:block;"
              />

              <div
                class="cpBadge ok"
                style="top:6px;left:6px;${isSelected ? "" : "display:none;"}"
              >
                Seçili
              </div>

             <div
  class="cpOverlay"
  aria-hidden="false"
  style="opacity:${isSelected ? "1" : "0"};background:transparent;position:absolute;left:50%;bottom:6px;transform:translateX(-50%);display:flex;justify-content:center;pointer-events:none;z-index:4;transition:opacity .18s ease;"
>
  <div
    class="cpOverlayBtns"
    style="display:flex;gap:4px;padding:4px 5px;border-radius:999px;background:rgba(10,12,22,.58);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,.22);pointer-events:auto;"
  >
    <button
      type="button"
      class="cpBtn"
      data-act="download"
      data-character-id="${itemId.replace(/"/g, "&quot;")}"
      title="İndir"
      style="width:22px;height:22px;border-radius:999px;background:transparent;border:none;color:rgba(255,255,255,.92);display:grid;place-items:center;padding:0;"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style="width:13px;height:13px;">
        <path d="M12 3v11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M7.5 10.8 12 15.3l4.5-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>

    <button
      type="button"
      class="cpBtn"
      data-act="select"
      data-character-id="${itemId.replace(/"/g, "&quot;")}"
      title="Kullan"
      style="width:22px;height:22px;border-radius:999px;background:transparent;border:none;color:rgba(255,255,255,.92);display:grid;place-items:center;padding:0;"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style="width:13px;height:13px;">
        <path d="M5 12.5 9.2 16.7 19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <button
      type="button"
      class="cpBtn danger"
      data-act="delete"
      data-character-id="${itemId.replace(/"/g, "&quot;")}"
      title="Sil"
      style="width:22px;height:22px;border-radius:999px;background:transparent;border:none;color:rgba(255,120,120,.95);display:grid;place-items:center;padding:0;"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style="width:13px;height:13px;">
        <path d="M4 7h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M10 11v7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M14 11v7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M6 7l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</div>
            </div>

            <div class="cpBottom" style="padding-top:4px;height:auto;min-height:18px;justify-content:center;">
              <div
                class="cpName"
                title="${name.replace(/"/g, "&quot;")}"
                style="font-size:11px;font-weight:700;line-height:1.1;text-align:center;"
              >${name}</div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  qsa(".cpCard", host).forEach((card) => {
    const overlay = qs(".cpOverlay", card);
    if (!overlay) return;

    card.addEventListener("mouseenter", () => {
      overlay.style.opacity = "1";
    });

    card.addEventListener("mouseleave", () => {
      if (!card.classList.contains("is-selected")) {
        overlay.style.opacity = "0";
      }
    });

    card.addEventListener("click", () => {
      qsa(".cpCard .cpOverlay", host).forEach((el) => {
        el.style.opacity = "0";
      });
      overlay.style.opacity = "1";
    });
  });
}
 function render(root) {
  if (!root) return;

  syncModeTabs(root);
  syncModeViews(root);
  syncMainSelection(root);
  syncHelperSelection(root);
  syncSceneSelection(root);
  syncActionSelection(root);
  syncFormValues(root);
  updatePromptCount(root);
  updateHelperCount(root);
  updateUploadText(root);
  updateSummary(root);
 renderCharacterLibrary(root);
}

  function buildBasicPayload() {
    return {
      app: "cartoon",
      mode: state.mode,
      extraPrompt: state.extraPrompt,
      mainCharacter: state.mainCharacter,
      helperCharacters: [...state.helpers],
      scene: state.scene,
      action: state.action,
      duration: state.duration,
      aspectRatio: state.ratio,
      audioEnabled: !!state.audioEnabled,
      characterImage: state.characterImage,
      characterImageName: state.characterImageName,
      estimatedCredits: getEstimatedCredits()
    };
  }

  function buildCharacterCreatePayload(root) {
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

    const payload = {
      mode: "character",
      type: (typeEl?.value || "").trim(),
      name: (nameEl?.value || "").trim(),
      prompt: (descEl?.value || "").trim(),
      style: (styleEl?.value || "").trim(),
      referenceFile: fileEl?.files?.[0] || null
    };

    return payload;
  }
  async function pollCartoonJob(jobId, tries = 0) {
    try {
      const r = await fetch(
        `/api/jobs/status?job_id=${encodeURIComponent(jobId)}&debug=1`
      );
      const j2 = await r.json().catch(() => null);

      console.log("[CARTOON] poll =", j2);

      if (!j2 || j2.ok === false) {
        if (tries < 60) {
          setTimeout(() => pollCartoonJob(jobId, tries + 1), 3000);
        }
        return;
      }

            const readyVideoUrl = String(j2?.video?.url || "").trim();
      const readyImageUrl = String(j2?.image?.url || "").trim();
      const readyMode = String(
        j2?.mode ||
        j2?.meta?.mode ||
        j2?.job?.mode ||
        ""
      ).trim().toLowerCase();

           if (
        j2.status === "ready" &&
        (
          readyVideoUrl ||
          readyImageUrl ||
          (Array.isArray(j2?.outputs) && j2.outputs.some((o) => {
            const t = String(o?.type || o?.kind || o?.meta?.type || "").trim().toLowerCase();
            const u = String(o?.url || o?.image_url || o?.video_url || "").trim();
            return !!u && (t === "video" || t === "image");
          }))
        )
      ) {
        window.__LAST_CARTOON_STATUS__ = j2;

        window.dispatchEvent(
          new CustomEvent("aivo:cartoon:job_ready", {
            detail: {
              job_id: jobId,
              status: j2.status,
              mode: readyMode,
              video: readyVideoUrl ? j2.video : null,
              image: readyImageUrl ? j2.image : null,
              outputs: j2.outputs || [],
              raw: j2
            }
          })
        );
        return;
      }
      if (j2.status === "error") {
        console.error("[CARTOON] job error =", j2);
        return;
      }

      if (tries < 60) {
        setTimeout(() => pollCartoonJob(jobId, tries + 1), 3000);
      }
    } catch (err) {
      console.error("[CARTOON] poll error =", err);
      if (tries < 60) {
        setTimeout(() => pollCartoonJob(jobId, tries + 1), 3000);
      }
    }
  }

  function bindEvents() {

    document.addEventListener("click", (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const modeBtn = e.target.closest("[data-cartoon-mode]");
      if (modeBtn && root.contains(modeBtn)) {
        e.preventDefault();
        state.mode = modeBtn.dataset.cartoonMode || "basic";
        render(root);
        return;
      }

      const mainBtn = e.target.closest('[data-role="main"]');
      if (mainBtn && root.contains(mainBtn)) {
        e.preventDefault();
        state.mainCharacter = mainBtn.dataset.character || state.mainCharacter;
        render(root);
        return;
      }
   const characterActionBtn = e.target.closest("[data-act][data-character-id]");
if (characterActionBtn && root.contains(characterActionBtn)) {
  e.preventDefault();
  e.stopPropagation();

  const act = String(characterActionBtn.dataset.act || "").trim();
  const selectedId = String(characterActionBtn.dataset.characterId || "").trim();
  if (!selectedId) return;

  const selectedItem = (state.characters || []).find(
    (x) => String(x.id || x.job_id || "").trim() === selectedId
  );
  if (!selectedItem) return;

 if (act === "open") {
  if (!selectedItem.imageUrl) return;

  const existing = document.getElementById("cartoonCharacterPreviewModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "cartoonCharacterPreviewModal";
  modal.innerHTML = `
    <div
      data-preview-backdrop
      style="
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.82);
        z-index:99999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:24px;
      "
    >
<div
  style="
    position:relative;
    display:inline-block;
    max-width:min(92vw,1200px);
    max-height:88vh;
  "
>
  <button
    type="button"
    data-preview-close
    aria-label="Kapat"
    style="
      position:absolute;
      top:14px;
      right:14px;
      width:44px;
      height:44px;
      border:1px solid rgba(255,255,255,.18);
      border-radius:999px;
      background:rgba(15,18,28,.82);
      color:#fff;
      font-size:28px;
      line-height:1;
      cursor:pointer;
      display:grid;
      place-items:center;
      z-index:2;
      box-shadow:0 10px 30px rgba(0,0,0,.35);
      backdrop-filter:blur(10px);
    "
  >×</button>

  <img
    src="${String(selectedItem.imageUrl).replace(/"/g, "&quot;")}"
    alt="${String(selectedItem.name || "Karakter").replace(/"/g, "&quot;")}"
    style="
      max-width:min(92vw,1200px);
      max-height:88vh;
      width:auto;
      height:auto;
      display:block;
      border-radius:18px;
      box-shadow:0 18px 60px rgba(0,0,0,.45);
      background:#111;
    "
  />
</div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    const node = document.getElementById("cartoonCharacterPreviewModal");
    if (node) node.remove();
    document.removeEventListener("keydown", onEsc, true);
  };

  const onEsc = (evt) => {
    if (evt.key === "Escape") closeModal();
  };

  modal.addEventListener("click", (evt) => {
    if (
      evt.target.closest("[data-preview-close]") ||
      evt.target.hasAttribute("data-preview-backdrop")
    ) {
      closeModal();
    }
  });

  document.addEventListener("keydown", onEsc, true);
  return;
}

  if (act === "download") {
    if (!selectedItem.imageUrl) return;
    const a = document.createElement("a");
    a.href = selectedItem.imageUrl;
    a.download = `${(selectedItem.name || "character").replace(/[^\w\-]+/g, "_")}.jpg`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  if (act === "select") {
    state.selectedCreatedCharacterId = selectedId;

    const nameInput = qs("#cartoon-character-name", root);
    const descInput = qs("#cartoon-character-desc", root);
    const styleSelect = qs("#cartoon-character-style", root);

    if (nameInput) nameInput.value = selectedItem.name || "";
    if (descInput) descInput.value = selectedItem.prompt || "";
    if (styleSelect && selectedItem.style) styleSelect.value = selectedItem.style;

    render(root);
    return;
  }

  if (act === "delete") {
    state.characters = (state.characters || []).filter(
      (x) => String(x.id || x.job_id || "").trim() !== selectedId
    );

    if (String(state.selectedCreatedCharacterId || "") === selectedId) {
      state.selectedCreatedCharacterId = "";
    }

    render(root);
    return;
  }
}

const createdCharacterBtn = e.target.closest(".cpCard[data-character-id]");
console.log("[CARTOON][CHARACTER_CARD_CLICK]", e.target, createdCharacterBtn);
if (createdCharacterBtn && root.contains(createdCharacterBtn)) {
  e.preventDefault();

  const selectedId = String(createdCharacterBtn.dataset.characterId || "").trim();
  if (!selectedId) return;

  const selectedItem = (state.characters || []).find(
    (x) => String(x.id || x.job_id || "").trim() === selectedId
  );
  if (!selectedItem) return;

  state.selectedCreatedCharacterId = selectedId;

  const nameInput = qs("#cartoon-character-name", root);
  const descInput = qs("#cartoon-character-desc", root);
  const styleSelect = qs("#cartoon-character-style", root);

  if (nameInput) nameInput.value = selectedItem.name || "";
  if (descInput) descInput.value = selectedItem.prompt || "";
  if (styleSelect && selectedItem.style) styleSelect.value = selectedItem.style;

  render(root);
  return;
}
      const helperBtn = e.target.closest('[data-role="helper"]');
      if (helperBtn && root.contains(helperBtn)) {
        e.preventDefault();
        const value = helperBtn.dataset.character;
        if (!value) return;

        const exists = state.helpers.includes(value);

        if (exists) {
          state.helpers = state.helpers.filter((x) => x !== value);
        } else {
          if (state.helpers.length >= 3) return;
          state.helpers = [...state.helpers, value];
        }

        render(root);
        return;
      }

      const sceneBtn = e.target.closest("[data-scene]");
      if (sceneBtn && root.contains(sceneBtn)) {
        e.preventDefault();
        state.scene = sceneBtn.dataset.scene || state.scene;
        render(root);
        return;
      }
      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn && root.contains(actionBtn)) {
        e.preventDefault();
        state.action = actionBtn.dataset.action || state.action;
        render(root);
        return;
      }

          const characterCreateBtn = e.target.closest("[data-cartoon-character-create]");
      if (characterCreateBtn && root.contains(characterCreateBtn)) {
        e.preventDefault();

        const payload = buildCharacterCreatePayload(root);
        console.log("[CARTOON][CHARACTER] payload =", payload);

        characterCreateBtn.disabled = true;
        const prevText = characterCreateBtn.textContent;
        characterCreateBtn.textContent = "Oluşturuluyor...";
        characterCreateBtn.classList.add("is-loading");

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
                    createdAt: Date.now(),
                    meta: {
                      app: "cartoon",
                      mode: "character",
                      provider: "fal",
                      prompt: payload.prompt || "",
                      name: payload.name || "",
                      type: payload.type || "",
                      style: payload.style || ""
                    }
                  }
                })
              );

              pollCartoonJob(j.job_id);
            }
          })
          .catch((err) => {
            console.error("[CARTOON][CHARACTER] create error:", err);
            alert(String(err?.message || err || "character_create_failed"));
          })
          .finally(() => {
            characterCreateBtn.disabled = false;
            characterCreateBtn.textContent = prevText;
            characterCreateBtn.classList.remove("is-loading");
          });

        return;
      }

      const generateBtn = e.target.closest("[data-cartoon-generate]");
      
      if (generateBtn && root.contains(generateBtn)) {
        e.preventDefault();

        const payload = buildBasicPayload();

        generateBtn.disabled = true;
        const prevText = generateBtn.textContent;
        generateBtn.textContent = "Üretiliyor...";
        generateBtn.classList.add("is-loading");

        fetch("/api/providers/fal/cartoon/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(async (r) => {
            const j = await r.json().catch(() => null);
            if (!r.ok || !j || j.ok === false) {
              throw new Error(j?.error || `cartoon_create_failed_${r.status}`);
            }

            console.log("[CARTOON] create ok =", j);

            if (j?.job_id) {
              window.dispatchEvent(
                new CustomEvent("aivo:cartoon:job_created", {
                  detail: {
                    app: "cartoon",
                    job_id: j.job_id,
                    prompt: payload.extraPrompt || "",
                    createdAt: Date.now(),
                    meta: {
                      app: "cartoon",
                      provider: "fal",
                      prompt: [
                        payload.mainCharacter,
                        ...(payload.helperCharacters || []),
                        payload.scene,
                        payload.action,
                        payload.extraPrompt
                      ]
                        .filter(Boolean)
                        .join(" • "),
                      duration: payload.duration,
                      aspect_ratio: payload.aspectRatio
                    }
                  }
                })
              );

              pollCartoonJob(j.job_id);
            }
          })
          .catch((err) => {
            console.error("[CARTOON] create error:", err);
            alert(String(err?.message || err || "cartoon_create_failed"));
          })
         

        return;
      }
    });
        window.addEventListener("aivo:cartoon:job_ready", (e) => {
      const d = e?.detail || {};
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

      const raw = d?.raw || {};
      const meta = raw?.meta || {};
      const root = getCartoonRoot();
      const fallbackName = qs("#cartoon-character-name", root)?.value || "";
      const fallbackStyle = qs("#cartoon-character-style", root)?.value || "";
      const nextItem = {
        id: String(d.job_id || `character_${Date.now()}`),
        job_id: String(d.job_id || ""),
      name: String(
  meta?.name ||
  raw?.name ||
  raw?.meta?.ui_state?.name ||
  raw?.ui_state?.name ||
  fallbackName ||
  "Karakter"
).trim(),
        type: String(meta?.type || raw?.type || "").trim(),
       style: String(
  meta?.style ||
  raw?.style ||
  raw?.meta?.ui_state?.style ||
  raw?.ui_state?.style ||
  fallbackStyle ||
  ""
).trim(),
        prompt: String(meta?.prompt || raw?.prompt || "").trim(),
        imageUrl
      };

      const exists = state.characters.some(
        (x) => String(x.job_id || x.id) === String(nextItem.job_id || nextItem.id)
      );
      if (exists) return;

      state.characters = [nextItem, ...state.characters];
     if (root) render(root);
    });
    document.addEventListener("input", (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const prompt = e.target.closest("[data-cartoon-prompt-input]");
      if (prompt && root.contains(prompt)) {
        state.extraPrompt = String(prompt.value || "");
        updatePromptCount(root);
        updateSummary(root);
      }
    });

    document.addEventListener("change", (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const duration = e.target.closest("#cartoon-duration");
      if (duration && root.contains(duration)) {
        state.duration = duration.value || "5";
        updateSummary(root);
        return;
      }

      const ratio = e.target.closest("#cartoon-ratio");
      if (ratio && root.contains(ratio)) {
        state.ratio = ratio.value || "16:9";
        updateSummary(root);
        return;
      }

      const audio = e.target.closest("[data-audio-enabled]");
      if (audio && root.contains(audio)) {
        state.audioEnabled = !!audio.checked;
        updateSummary(root);
        return;
      }

      const upload = e.target.closest("[data-character-upload]");
      if (upload && root.contains(upload)) {
        const file = upload.files && upload.files[0] ? upload.files[0] : null;
        state.characterImage = file;
        state.characterImageName = file ? file.name : "";
        updateUploadText(root);
        updateSummary(root);
      }
    });
  }
  async function hydrateCharacterLibrary(root) {
    try {
      const res = await fetch("/api/jobs/list?app=cartoon", { credentials: "same-origin" });
      const json = await res.json().catch(() => null);

      const rows =
        
        (Array.isArray(json) && json) ||
        (Array.isArray(json?.items) && json.items) ||
        (Array.isArray(json?.jobs) && json.jobs) ||
        (Array.isArray(json?.rows) && json.rows) ||
        [];
      console.log("[CARTOON][CHARACTER_HYDRATE_ROWS]", rows);
      console.log("[CARTOON][CHARACTER_HYDRATE_FIRST]", rows[0]);
      console.log("[CARTOON][CHARACTER_HYDRATE_FIRST_JSON]", JSON.stringify(rows[0], null, 2));
      const nextCharacters = rows
        .map((row) => {
          const mode = String(
            row?.mode ||
            row?.meta?.mode ||
            row?.payload?.mode ||
            row?.request?.mode ||
            row?.input?.mode ||
            ""
          ).trim().toLowerCase();

          const outputs = Array.isArray(row?.outputs) ? row.outputs : [];

          const imageFromOutputs = outputs.find((o) => {
            const t = String(o?.type || o?.kind || o?.meta?.type || "").trim().toLowerCase();
            const u = String(o?.url || o?.image_url || "").trim();
            return t === "image" && !!u;
          });

          const imageUrl = String(
            row?.image?.url ||
            row?.image_url ||
            imageFromOutputs?.url ||
            imageFromOutputs?.image_url ||
            ""
          ).trim();

          if (mode !== "character" || !imageUrl) return null;

          return {
            id: String(row?.job_id || row?.id || imageUrl),
            job_id: String(row?.job_id || row?.id || ""),
           name: String(
  row?.meta?.name ||
  row?.name ||
  row?.payload?.name ||
  row?.request?.name ||
  row?.input?.name ||
  row?.fal_input?.name ||
 row?.meta?.ui_state?.name ||
  row?.ui_state?.name ||
  (String(
    row?.prompt ||
    row?.meta?.prompt ||
    row?.payload?.prompt ||
    ""
  ).trim().slice(0, 32)) ||
  "Karakter"
).trim(),
                type: String(
              row?.meta?.type ||
              row?.type ||
              row?.payload?.type ||
              row?.meta?.ui_state?.type ||
              ""
            ).trim(),
            style: String(
              row?.meta?.style ||
              row?.style ||
              row?.payload?.style ||
              row?.meta?.ui_state?.style ||
              ""
            ).trim(),
            prompt: String(
              row?.meta?.prompt ||
              row?.prompt ||
              row?.payload?.prompt ||
              ""
            ).trim(),
            imageUrl
          };
        })
        .filter(Boolean);

      state.characters = nextCharacters;
      if (root) render(root);
    } catch (err) {
      console.error("[CARTOON][CHARACTER_HYDRATE] failed =", err);
    }
  }
  function initFromDOM(root) {
    if (!root) return;

    const selectedMain = qs('[data-role="main"].is-selected', root);
    const selectedScene = qs('[data-scene].is-selected', root);
    const selectedAction = qs('[data-action].is-selected', root);
    const selectedHelpers = qsa('[data-role="helper"].is-selected', root);

    const prompt = qs("[data-cartoon-prompt-input]", root);
    const duration = qs("#cartoon-duration", root);
    const ratio = qs("#cartoon-ratio", root);
    const audio = qs("[data-audio-enabled]", root);

    if (selectedMain?.dataset.character) state.mainCharacter = selectedMain.dataset.character;
    if (selectedScene?.dataset.scene) state.scene = selectedScene.dataset.scene;
    if (selectedAction?.dataset.action) state.action = selectedAction.dataset.action;

    state.helpers = selectedHelpers
      .map((btn) => btn.dataset.character)
      .filter(Boolean)
      .slice(0, 3);

    if (prompt) state.extraPrompt = String(prompt.value || "");
    if (duration?.value) state.duration = duration.value;
    if (ratio?.value) state.ratio = ratio.value;
    if (audio) state.audioEnabled = !!audio.checked;

    render(root);
  }

  function tryInit() {
    const root = getCartoonRoot();
    if (!root) return false;
    initFromDOM(root);
    hydrateCharacterLibrary(root);
    return true;
  }

  bindEvents();

  if (!tryInit()) {
    const observer = new MutationObserver(() => {
      if (tryInit()) observer.disconnect();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
