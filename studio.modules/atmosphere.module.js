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
// ===============================
// ATMOSPHERE — Generate CTA (delegated, router-safe)
// ===============================
(() => {
  if (window.__ATM_GEN_BIND__) return;
  window.__ATM_GEN_BIND__ = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

  function readBasicPayload(panel) {
    const scenesRoot = qs("#atmScenes", panel);
    const sceneBtn = scenesRoot ? qs(".smpack-choice.is-active", scenesRoot) : null;
    const scene = sceneBtn?.dataset?.atmScene || null;

    const effectsRoot = qs("#atmEffects", panel);
    const effects = effectsRoot
      ? qsa(".atm-pill.is-active, .smpack-pill.is-active", effectsRoot).map(b => b.dataset.atmEff).filter(Boolean)
      : [];

    const camera = qs("#atmCamera", panel)?.value || "kenburns_soft";
    const duration = qs("#atmDuration", panel)?.value || "8";

    const imgFile = qs("#atmImageFile", panel)?.files?.[0] || null;

    return { mode: "basic", scene, effects, camera, duration, imgFile };
  }

  function readProPayload(panel) {
    const prompt = (qs("#atmSuperPrompt", panel)?.value || "").trim();

    // mood pills
    const moodBtns = qsa('[data-atm-mood].is-active', panel);
    const mood = moodBtns[0]?.dataset?.atmMood || null;

    const format = qs("#atmProFormat", panel)?.value || "mp4";

    const refImage = qs("#atmSceneImageInput", panel)?.files?.[0] || null;
    const refAudio = qs("#atmSceneAudioInput", panel)?.files?.[0] || null;

    return { mode: "pro", prompt, mood, format, refImage, refAudio };
  }

  async function onGenerateClick(btn) {
    const panel = btn.closest('.main-panel[data-module="atmosphere"]');
    if (!panel) return;

    const mode = btn.dataset.atmMode || "basic";

    // TODO: burayı senin mevcut create akışına bağlayacağız.
    // Şimdilik payload'u konsola basıyorum ki doğru okuyor mu görelim:
    const payload = mode === "pro" ? readProPayload(panel) : readBasicPayload(panel);
    console.log("[ATM] generate payload =", payload);

    // Eğer sende mevcut bir create fonksiyonu varsa burada çağır:
    // window.ATM_CREATE?.(payload) gibi...
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-atm-generate]");
    if (!btn) return;
    onGenerateClick(btn);
  });

})();
