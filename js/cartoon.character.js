(() => {
  if (window.__CARTOON_CHARACTER_BIND__) return;
  window.__CARTOON_CHARACTER_BIND__ = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getCartoonRoot() {
    return qs('.main-panel[data-module="cartoon"]');
  }

  function getState() {
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

  function updateCharacterDescCount(root) {
    const input = qs("[data-character-desc]", root);
    const out = qs("[data-character-desc-count]", root);
    if (!input || !out) return;

    const len = String(input.value || "").length;
    out.textContent = `${len} / 1000`;
  }

  function updateCharacterCreateUploadUI(root) {
    const input = qs("[data-character-create-upload]", root);
    if (!input) return;

    const host =
      input.closest(".cartoon-upload-wrap") ||
      input.parentElement ||
      input.closest("label") ||
      input;

    let nameEl = qs("[data-character-create-file-name]", host);
    if (!nameEl) {
      nameEl = document.createElement("div");
      nameEl.setAttribute("data-character-create-file-name", "");
      nameEl.style.marginTop = "8px";
      nameEl.style.fontSize = "13px";
      nameEl.style.fontWeight = "600";
      nameEl.style.color = "rgba(255,255,255,.88)";
      host.appendChild(nameEl);
    }

    let previewEl = qs("[data-character-create-preview]", host);
    if (!previewEl) {
      previewEl = document.createElement("img");
      previewEl.setAttribute("data-character-create-preview", "");
      previewEl.alt = "Referans görsel önizleme";
      previewEl.style.display = "none";
      previewEl.style.width = "72px";
      previewEl.style.height = "72px";
      previewEl.style.objectFit = "cover";
      previewEl.style.borderRadius = "12px";
      previewEl.style.marginTop = "10px";
      previewEl.style.border = "1px solid rgba(255,255,255,.12)";
      host.appendChild(previewEl);
    }

    const file = input.files && input.files[0] ? input.files[0] : null;

    if (!file) {
      nameEl.textContent = "";
      previewEl.style.display = "none";
      previewEl.removeAttribute("src");
      return;
    }

    nameEl.textContent = "";

    try {
      const nextUrl = URL.createObjectURL(file);

      if (previewEl.dataset.objectUrl) {
        try { URL.revokeObjectURL(previewEl.dataset.objectUrl); } catch {}
      }

      previewEl.src = nextUrl;
      previewEl.dataset.objectUrl = nextUrl;
      previewEl.style.display = "block";
    } catch {
      previewEl.style.display = "none";
    }
  }

  function renderCharacterLibrary(root) {
    const state = getState();

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
      ${items.map((item) => {
        const itemId = String(item.id || item.job_id || "");
        const imageUrl = String(item.imageUrl || "").trim();
        const name = String(item.name || "Karakter").trim();
        const isSelected = String(state.selectedCreatedCharacterId || "") === itemId;

        return `
          <div
            class="cpCard ${isSelected ? "is-selected" : ""}"
            data-character-id="${itemId.replace(/"/g, "&quot;")}"
            tabindex="0"
            style="width:92px;box-sizing:border-box;padding:6px;border-radius:12px;position:relative;"
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

  function renderCharacterOnly(root) {
    if (!root) return;
    updateCharacterDescCount(root);
    updateCharacterCreateUploadUI(root);
    renderCharacterLibrary(root);
  }

  function buildCharacterCreatePayload(root) {
    const state = getState();

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

  function extractImageUrlFromOutputs(outputs) {
    if (!Array.isArray(outputs)) return "";

    const imageFromOutputs = outputs.find((o) => {
      const t = String(o?.type || o?.kind || o?.meta?.type || "").trim().toLowerCase();
      const u = String(o?.url || o?.image_url || "").trim();
      return t === "image" && !!u;
    });

    return String(
      imageFromOutputs?.url ||
      imageFromOutputs?.image_url ||
      ""
    ).trim();
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
        extractImageUrlFromOutputs(j2?.outputs) ||
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

        const root = getCartoonRoot();
        const createBtn = root?.querySelector("[data-cartoon-character-create]");
        const state = getState();

        state.characterCreatePending = false;

        if (createBtn) {
          createBtn.disabled = false;
          createBtn.textContent = "🧩 Karakter Oluştur";
        }
        return;
      }

      if (tries < 60) {
        setTimeout(() => pollCartoonCharacterJob(jobId, tries + 1), 3000);
      }
    } catch (err) {
      console.error("[CARTOON][CHARACTER] poll error =", err);

      if (tries < 60) {
        setTimeout(() => pollCartoonCharacterJob(jobId, tries + 1), 3000);
        return;
      }

      const root = getCartoonRoot();
      const createBtn = root?.querySelector("[data-cartoon-character-create]");
      const state = getState();

      state.characterCreatePending = false;

      if (createBtn) {
        createBtn.disabled = false;
        createBtn.textContent = "🧩 Karakter Oluştur";
      }
    }
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
          const imageUrl = String(
            row?.image?.url ||
            row?.image_url ||
            extractImageUrlFromOutputs(outputs) ||
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
            uiState: row?.meta?.ui_state || row?.ui_state || {},
            imageUrl
          };
        })
        .filter(Boolean);

      const state = getState();
      state.characters = nextCharacters;

      if (root) renderCharacterOnly(root);
    } catch (err) {
      console.error("[CARTOON][CHARACTER_HYDRATE] failed =", err);
    }
  }

  document.addEventListener("input", (e) => {
    const root = getCartoonRoot();
    if (!root) return;

    const characterDesc = e.target.closest("[data-character-desc]");
    if (characterDesc && root.contains(characterDesc)) {
      updateCharacterDescCount(root);
    }
  });

  document.addEventListener("change", async (e) => {
    const root = getCartoonRoot();
    if (!root) return;

    const state = getState();

    const characterCreateUpload = e.target.closest("[data-character-create-upload]");
    if (!characterCreateUpload || !root.contains(characterCreateUpload)) return;

    const file =
      characterCreateUpload.files && characterCreateUpload.files[0]
        ? characterCreateUpload.files[0]
        : null;

    updateCharacterCreateUploadUI(root);

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

    const state = getState();

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
                title="Kapat"
                style="
                  position:absolute;
                  top:16px;
                  right:16px;
                  width:42px;
                  height:42px;
                  border:none;
                  border-radius:999px;
                  background:rgba(12,14,24,.72);
                  color:rgba(255,255,255,.96);
                  cursor:pointer;
                  display:grid;
                  place-items:center;
                  z-index:5;
                  box-shadow:0 10px 30px rgba(0,0,0,.32);
                  backdrop-filter:blur(12px);
                  -webkit-backdrop-filter:blur(12px);
                "
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" style="width:18px;height:18px;display:block;">
                  <path
                    d="M7 7l10 10M17 7 7 17"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>

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

  const cleanUrl = String(selectedItem.imageUrl || "").trim();
  const proxied = `/api/media/proxy?url=${encodeURIComponent(cleanUrl)}&filename=${encodeURIComponent(
    `${(selectedItem.name || "character").replace(/[^\w\-]+/g, "_")}.jpg`
  )}`;

  const a = document.createElement("a");
  a.href = proxied;
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

        renderCharacterLibrary(root);
        updateCharacterDescCount(root);
        return;
      }

      if (act === "delete") {
        state.characters = (state.characters || []).filter(
          (x) => String(x.id || x.job_id || "").trim() !== selectedId
        );

        if (String(state.selectedCreatedCharacterId || "") === selectedId) {
          state.selectedCreatedCharacterId = "";
        }

        renderCharacterLibrary(root);
        return;
      }
    }

    const createdCharacterBtn = e.target.closest(".cpCard[data-character-id]");
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

      if (nameInput && selectedItem.name) {
        nameInput.value = selectedItem.name;
      }

      const ui = selectedItem.uiState || {};
      const nextPrompt = selectedItem.prompt || ui.prompt || "";

      if (descInput && nextPrompt) {
        descInput.value = nextPrompt;
      }

      if (styleSelect && (selectedItem.style || ui.style)) {
        styleSelect.value = selectedItem.style || ui.style;
      }

      const hairTypeSelect = qs("[data-character-hair-type]", root);
      const hairColorSelect = qs("[data-character-hair-color]", root);
      const outfitSelect = qs("[data-character-outfit]", root);
      const glassesSelect = qs("[data-character-glasses]", root);
      const accessorySelect = qs("[data-character-accessory]", root);
      const expressionSelect = qs("[data-character-expression]", root);

      if (hairTypeSelect && ui.hairType) hairTypeSelect.value = ui.hairType;
      if (hairColorSelect && ui.hairColor) hairColorSelect.value = ui.hairColor;
      if (outfitSelect && ui.outfit) outfitSelect.value = ui.outfit;
      if (glassesSelect && ui.glasses) glassesSelect.value = ui.glasses;
      if (accessorySelect && ui.accessory) accessorySelect.value = ui.accessory;
      if (expressionSelect && ui.expression) expressionSelect.value = ui.expression;

      renderCharacterLibrary(root);
      updateCharacterDescCount(root);
      return;
    }

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
    const state = getState();

    const mode = String(
      d?.mode ||
      d?.raw?.mode ||
      d?.raw?.meta?.mode ||
      ((d?.image?.url || d?.raw?.image?.url) ? "character" : "")
    ).trim().toLowerCase();

    const imageUrl = String(
      d?.image?.url ||
      d?.raw?.image?.url ||
      extractImageUrlFromOutputs(d?.outputs) ||
      extractImageUrlFromOutputs(d?.raw?.outputs) ||
      ""
    ).trim();

    if (mode !== "character" || !imageUrl) return;

    const meta = raw?.meta || {};
    const fallbackName = root ? (qs("#cartoon-character-name", root)?.value || "") : "";
    const fallbackStyle = root ? (qs("#cartoon-character-style", root)?.value || "") : "";

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
      uiState: {
        name:
          raw?.meta?.ui_state?.name ||
          raw?.ui_state?.name ||
          (root ? (qs("#cartoon-character-name", root)?.value || "") : ""),
        type:
          raw?.meta?.ui_state?.type ||
          raw?.ui_state?.type ||
          (root ? (qs("#cartoon-character-type", root)?.value || "") : ""),
        style:
          raw?.meta?.ui_state?.style ||
          raw?.ui_state?.style ||
          (root ? (qs("#cartoon-character-style", root)?.value || "") : ""),
        prompt:
          raw?.meta?.ui_state?.prompt ||
          raw?.ui_state?.prompt ||
          (root ? (qs("#cartoon-character-desc", root)?.value || "") : ""),
        hairType:
          raw?.meta?.ui_state?.hairType ||
          raw?.ui_state?.hairType ||
          (root ? (qs("[data-character-hair-type]", root)?.value || "") : ""),
        hairColor:
          raw?.meta?.ui_state?.hairColor ||
          raw?.ui_state?.hairColor ||
          (root ? (qs("[data-character-hair-color]", root)?.value || "") : ""),
        outfit:
          raw?.meta?.ui_state?.outfit ||
          raw?.ui_state?.outfit ||
          (root ? (qs("[data-character-outfit]", root)?.value || "") : ""),
        glasses:
          raw?.meta?.ui_state?.glasses ||
          raw?.ui_state?.glasses ||
          (root ? (qs("[data-character-glasses]", root)?.value || "") : ""),
        accessory:
          raw?.meta?.ui_state?.accessory ||
          raw?.ui_state?.accessory ||
          (root ? (qs("[data-character-accessory]", root)?.value || "") : ""),
        expression:
          raw?.meta?.ui_state?.expression ||
          raw?.ui_state?.expression ||
          (root ? (qs("[data-character-expression]", root)?.value || "") : "")
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

    if (root) {
      renderCharacterOnly(root);
    }
  });

  function tryInit() {
    const root = getCartoonRoot();
    if (!root) return false;
    renderCharacterOnly(root);
    hydrateCharacterLibrary(root);
    return true;
  }

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
