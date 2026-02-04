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

        // ✅ RightPanel Music: 2 slot'u tetikle (backend beklemeden)
        try {
          window.dispatchEvent(
            new CustomEvent("aivo:music:placeholder", { detail: { ts: Date.now() } })
          );
          console.log("[music-generate] placeholder event fired");
        } catch (err) {
          console.warn("[music-generate] placeholder event failed", err);
        }

        // spam click kilidi
        if (btn.dataset.busy === "1") {
          console.warn("[music-generate] busy, ignore click");
          return;
        }
        btn.dataset.busy = "1";
        btn.disabled = true;

        console.log("[music-generate] clicked");

        // ✅ UI: Eski sistem varsa dener (bu build'de yoksa sorun değil)
        let pair = null;
        try {
          pair =
            window.AIVO_MUSIC_CARDS?.addProcessingPair?.({
              name: "Yeni Müzik",
              prompt: "",
            }) || null;
          console.log("[music-generate] addProcessingPair ok", pair);
        } catch (e2) {
          console.warn("[music-generate] addProcessingPair failed", e2);
        }

        try {
          const r = await fetch("/api/music/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "music" }),
          });

          const j = await r.json().catch(() => null);
          con
