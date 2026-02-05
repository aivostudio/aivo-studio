// =========================================================
// studio.music.generate.js — CLEAN (NO FAKE CARD)
// ✅ Job create => /api/jobs/create
// ✅ Music generate => /api/music/generate
// ✅ Panel + real player lifecycle => aivo:job event + panel.music.js polls status + AIVO_PLAYER.add(meta)
// =========================================================
(function () {
  console.log("[music-generate] loaded (CLEAN: no DOM fake card)");

  const BTN_SEL = "#musicGenerateBtn";
  const PANEL_FORCE_KEY = "music";

  function pickPrompt() {
    const cands = [
      "#musicPrompt",
      "#prompt",
      "textarea[name='prompt']",
      "textarea[name='description']",
      "textarea[placeholder*='Prompt']",
      "textarea[placeholder*='detay']",
      ".musicPage textarea",
      "textarea"
    ];
    for (const sel of cands) {
      const el = document.querySelector(sel);
      if (el && String(el.value || "").trim()) return String(el.value || "").trim();
    }
    return "";
  }

  function forceMusicPanel() {
    try { window.RightPanel?.force?.(PANEL_FORCE_KEY); } catch (_) {}
  }

  async function createJob() {
    const jr = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "music" })
    });

    const j = await jr.json().catch(() => ({}));
    if (!jr.ok || !j.job_id) throw new Error("job_create_failed");
    return j.job_id;
  }

  async function fireGenerate(job_id, prompt) {
    // generate endpoint job_id ile tetikleniyor (response beklemiyoruz)
    fetch("/api/music/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id, prompt })
    }).catch(() => {});
  }

  function emitJob(payload) {
    // 1) internal store (panel bazı yerlerde buradan da bakabilir)
    try { window.AIVO_JOBS?.upsert?.(payload); } catch (_) {}

    // 2) panel.music.js bunu dinleyip render+poll yapacak
    try {
      window.dispatchEvent(new CustomEvent("aivo:job", { detail: payload }));
    } catch (_) {}
  }

  async function handleClick() {
    const prompt = pickPrompt();
    if (!prompt) {
      alert("Prompt boş");
      return;
    }

    forceMusicPanel();

    const job_id = await createJob();
    console.log("[music-generate] job created", job_id);

    const payload = {
      job_id,
      type: "music",
      status: "queued",
      prompt,
      title: "Yeni Müzik"
    };

    // ✅ Tek doğru yol: panel'e job'ı bildir (kartı panel basacak)
    emitJob(payload);

    // generate tetikle
    fireGenerate(job_id, prompt);
  }

  // delegated click (router remount olsa da çalışır)
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(BTN_SEL);
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    handleClick().catch((err) => {
      console.error("[music-generate] error", err);
      alert(err?.message || "Müzik başlatılamadı");
    });
  }, true);
})();
