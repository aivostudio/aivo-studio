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
// Amaç: Router/re-render olsa bile generate butonu çalışsın
// ===============================
(() => {
  // ✅ Bind guard: bu block sadece 1 kere kurulsun
  if (window.__ATM_GEN_BIND__) return;
  window.__ATM_GEN_BIND__ = true;

  // --------------------------------
  // Helper: querySelector (tek eleman)
  // --------------------------------
  const qs = (sel, root = document) => root.querySelector(sel);

  // --------------------------------
  // Helper: querySelectorAll (liste)
  // --------------------------------
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

  // --------------------------------
  // BASIC Payload Reader
  // Amaç: Basit mod state'ini DOM'dan güvenle oku
  // Not: EFFECTS source-of-truth = checkbox (.atm-check)
  // --------------------------------
  function readBasicPayload(panel) {
    // Scene (single select)
    const scenesRoot = qs("#atmScenes", panel);
    const sceneBtn = scenesRoot ? qs(".smpack-choice.is-active", scenesRoot) : null;
    const scene = sceneBtn?.dataset?.atmScene || null;

    // ✅ Effects (multi select) — CHECKBOX SOURCE OF TRUTH
    // UI pill is-active kalsa bile payload burada kesin doğru olur
    const effectsRoot = qs("#atmEffects", panel);
    const effects = effectsRoot
      ? qsa('input.atm-check[type="checkbox"]:checked', effectsRoot)
          .map((c) => (c.value || "").trim())
          .filter(Boolean)
      : [];

    // Kamera / Süre
    const camera = qs("#atmCamera", panel)?.value || "kenburns_soft";
    const duration = qs("#atmDuration", panel)?.value || "8";

    // Kendi görseli (opsiyonel)
    const imgFile = qs("#atmImageFile", panel)?.files?.[0] || null;

    return { mode: "basic", scene, effects, camera, duration, imgFile };
  }

  // --------------------------------
  // PRO Payload Reader
  // Amaç: Süper mod state'ini DOM'dan güvenle oku
  // --------------------------------
  function readProPayload(panel) {
    const prompt = (qs("#atmSuperPrompt", panel)?.value || "").trim();

    // Mood (single select)
    const moodBtn = qs('[data-atm-mood].is-active', panel);
    const mood = moodBtn?.dataset?.atmMood || null;

    const format = qs("#atmProFormat", panel)?.value || "mp4";

    const refImage = qs("#atmSceneImageInput", panel)?.files?.[0] || null;
    const refAudio = qs("#atmSceneAudioInput", panel)?.files?.[0] || null;

    return { mode: "pro", prompt, mood, format, refImage, refAudio };
  }

  // --------------------------------
  // Generate Click Handler
  // Amaç: Butona basılınca doğru panel/mode/payload'u okuyup işlemek
  // Şimdilik: payload log (sonraki adım: create → poll → PPE.apply)
  // --------------------------------
  async function onGenerateClick(btn) {
    // Atmosphere panel scope
    const panel = btn.closest('.main-panel[data-module="atmosphere"]');
    if (!panel) return;

    const mode = btn.dataset.atmMode || "basic";

    const payload = mode === "pro" ? readProPayload(panel) : readBasicPayload(panel);
    console.log("[ATM] generate payload =", payload);

    // TODO (sonraki adım):
    // burada /api/jobs/create → poll /api/jobs/status → PPE.apply zinciri
    // örn: await window.ATM_CREATE?.(payload)
  }

  // --------------------------------
  // Delegated Click Binder
  // Amaç: DOM yenilense bile [data-atm-generate] tıklamasını yakala
  // --------------------------------
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-atm-generate]");
    if (!btn) return;
    onGenerateClick(btn);
  });

})();
