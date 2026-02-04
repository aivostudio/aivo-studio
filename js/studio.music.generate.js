// studio.music.generate.js
window.__MUSIC_GENERATE__ = true;
console.log("[music-generate] script loaded");
(function () {
  if (window.__MUSIC_GENERATE_WIRED__) return;
  window.__MUSIC_GENERATE_WIRED__ = true;

  function findBtn() {
    return (
      document.getElementById("musicGenerateBtnn") ||
      document.getElementById("musicGenerateBtn") ||
      document.querySelector('button[data-generate="music"]')
    );
  }

  function wire() {
    const btn = findBtn();
    if (!btn) {
      console.warn("[music-generate] button not found, retrying…");
      setTimeout(wire, 500);
      return;
    }

    if (btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";

    console.log("[music-generate] wired", btn);

    btn.addEventListener("click", async () => {
      console.log("[music-generate] clicked");

      try {
        const r = await fetch("/api/music/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "music" }),
        });

        const j = await r.json();
        console.log("[music-generate] response", j);

        const jobId = j.job_id || j.jobId || j.id;
        if (!jobId) return console.error("[music-generate] job_id yok");

        window.AIVO_JOBS?.upsert?.({
          job_id: jobId,
          type: "music",
          created_at: Date.now(),
        });
      } catch (e) {
        console.error("[music-generate] error", e);
      }
    });
  }

  wire();
})();
