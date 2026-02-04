// studio.music.generate.js
window.__MUSIC_GENERATE__ = true;
console.log("[music-generate] REAL-mode script loaded");

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

  async function onClick(btn, e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (btn.dataset.busy === "1") return;
    btn.dataset.busy = "1";
    btn.disabled = true;

    console.log("[music-generate] clicked");

    try {
      const r = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "music" }),
      });

      const j = await r.json().catch(() => null);
      console.log("[music-generate] response", j);

      const jobId = j?.job_id || j?.jobId || j?.id;
      if (!jobId) {
        console.error("[music-generate] job_id yok", j);
        return;
      }

      // ✅ tek kaynak: job store
      window.AIVO_JOBS?.upsert?.({
        job_id: jobId,
        type: "music",
        created_at: Date.now(),
      });

      // ✅ gerçek player yolu: player.js API (yoksa zaten gerçek ekleme yok demektir)
      if (window.AIVO_PLAYER?.add) {
        window.AIVO_PLAYER.add({ job_id: jobId });
        console.log("[music-generate] AIVO_PLAYER.add ok", jobId);
      } else {
        console.warn("[music-generate] AIVO_PLAYER.add yok -> player.js'e API eklenmeden gerçek player basılamaz");
      }
    } catch (err) {
      console.error("[music-generate] error", err);
    } finally {
      btn.dataset.busy = "0";
      btn.disabled = false;
    }
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

    btn.addEventListener("click", (e) => onClick(btn, e), true);
  }

  wire();
})();
