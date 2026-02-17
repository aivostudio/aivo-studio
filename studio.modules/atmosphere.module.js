// ✅ SAFE: Pill tıklamasını bozmaz. Legacy state’i her değişimde günceller.
(() => {
  const root = document.getElementById("atmEffects");
  if (!root) return;

  const writeLegacy = () => {
    const hidden = document.getElementById("atmEffectsValue");

    const selected = [...root.querySelectorAll(".atm-check")]
      .filter(c => c.checked)
      .map(c => c.value);

    const val = selected.join(",");

    root.dataset.selected = val;
    if (hidden) hidden.value = val;

    window.__ATM__ = window.__ATM__ || {};
    window.__ATM__.selected = selected;
  };

  // ✅ checkbox change → legacy’ye yaz
  root.addEventListener("change", (e) => {
    if (!e.target.classList?.contains("atm-check")) return;

    // label UI (is-active/aria-pressed)
    const lab = e.target.closest(".atm-pill");
    if (lab) {
      lab.classList.toggle("is-active", e.target.checked);
      lab.setAttribute("aria-pressed", e.target.checked ? "true" : "false");
    }

    writeLegacy();
  });

  // ilk sync
  writeLegacy();
})();
// SUPER state (module scope)
const atmSuper = {
  sceneMode: "text", // "text" | "image"
  scenePrompt: "",
  sceneImageUrl: ""
};

function atmSuperBindSceneUI() {
  const btnText = document.getElementById("atmSceneModeText");
  const btnImg  = document.getElementById("atmSceneModeImage");
  const wrapText = document.getElementById("atmSceneTextWrap");
  const wrapImg  = document.getElementById("atmSceneImageWrap");
  const promptEl = document.getElementById("atmScenePrompt");
  const fileEl   = document.getElementById("atmSceneImageInput");
  const urlEl    = document.getElementById("atmSceneImageUrl");

  if (!btnText || !btnImg || !wrapText || !wrapImg || !promptEl || !fileEl || !urlEl) return;

  const setMode = (mode) => {
    atmSuper.sceneMode = mode;

    btnText.classList.toggle("is-active", mode === "text");
    btnImg.classList.toggle("is-active", mode === "image");

    wrapText.classList.toggle("is-hidden", mode !== "text");
    wrapImg.classList.toggle("is-hidden", mode !== "image");

    // CTA kilidi burada çağrılacak (bir sonraki adımda)
    // atmSuperSyncCtaState();
  };

  btnText.addEventListener("click", () => setMode("text"));
  btnImg.addEventListener("click", () => setMode("image"));

  promptEl.addEventListener("input", () => {
    atmSuper.scenePrompt = promptEl.value.trim();
    // atmSuperSyncCtaState();
  });

  fileEl.addEventListener("change", async () => {
    const f = fileEl.files && fileEl.files[0];
    if (!f) return;

    // TODO: senin upload endpoint’in neyse buraya bağlarız.
    // Şimdilik local preview/placeholder:
    atmSuper.sceneImageUrl = "uploaded://pending";
    urlEl.value = atmSuper.sceneImageUrl;

    // atmSuperSyncCtaState();
  });

  setMode("text");
}

// sayfa açılışında çağır
atmSuperBindSceneUI();
setTimeout(atmSuperBindSceneUI, 300);

// ATMOSPHERE MODE SWITCH — Delegated (router-safe)
document.addEventListener("click", function (e) {
  const tab = e.target.closest('.mode-tab[data-mode]');
  if (!tab) return;

  const shell = tab.closest('.mode-shell[data-mode-shell="atmosphere"]');
  if (!shell) return;

  const mode = tab.dataset.mode;

  // tabs
  shell.querySelectorAll('.mode-tab[data-mode]').forEach(t => {
    t.classList.toggle('is-active', t.dataset.mode === mode);
  });

  // panels
  shell.querySelectorAll('.mode-panel[data-mode-panel]').forEach(p => {
    p.classList.toggle('is-active', p.dataset.modePanel === mode);
  });
});
