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

    // zaten bağlandıysa çık
    if (btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";

    console.log("[music-generate] wired", btn);

    // ✅ CAPTURE + stopImmediatePropagation ile diğer click handler’ları yut
    btn.addEventListener(
      "click",
      async (e) => {
        // diğer handler’lar da varsa çalışmasın (double/triple create fix)
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // spam click kilidi
        if (btn.dataset.busy === "1") {
          console.warn("[music-generate] busy, ignore click");
          return;
        }
        btn.dataset.busy = "1";
        btn.disabled = true;

        console.log("[music-generate] clicked");

        // ✅ UI: Her tıkta 2’li slot (v1/v2) ANINDA bas (backend beklemez)
        let pair = null;
        try {
          pair = window.AIVO_MUSIC_CARDS?.addProcessingPair?.({
            name: "Yeni Müzik",
            prompt: ""
          }) || null;
          console.log("[music-generate] addProcessingPair ok", pair);
        } catch (e) {
          console.warn("[music-generate] addProcessingPair failed", e);
        }

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

          // job store’a yaz
          window.AIVO_JOBS?.upsert?.({
            job_id: jobId,
            type: "music",
            created_at: Date.now(),
          });

          // ✅ debug: bu job hangi 2’li slota karşılık geliyor?
          try {
            if (pair) {
              window.__MUSIC_JOB_PAIR__ = window.__MUSIC_JOB_PAIR__ || {};
              window.__MUSIC_JOB_PAIR__[jobId] = pair; // { v1, v2 }
              console.log("[music-generate] job->pair mapped", jobId, pair);
            }
          } catch (_) {}

          // ✅ panel'e sinyal (ileride kullanırsın)
          try {
            window.dispatchEvent(
              new CustomEvent("aivo:music:job", {
                detail: { job_id: jobId, pair, ts: Date.now() }
              })
            );
          } catch (_) {}
        } catch (err) {
          console.error("[music-generate] error", err);
        } finally {
          btn.dataset.busy = "0";
          btn.disabled = false;
        }
      },
      true // 👈 capture: en önde yakala
    );
  }

  wire();
})();
