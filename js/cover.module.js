// FILE: cover.module.js
console.log("[cover.module] loaded ✅", new Date().toISOString());

(function () {

  // --- COVER TEXT OVERLAY (auto) ---
  async function applyCoverTextOverlay(imageUrl) {
    console.log("[cover overlay entered]", imageUrl);

    const pick = (...sels) => {
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el && typeof el.value === "string") return el.value.trim();
        if (el && typeof el.textContent === "string" && el.tagName !== "SCRIPT") return el.textContent.trim();
      }
      return "";
    };

    let artist =
      pick('#coverArtist','input[name="artist"]','input[data-field="artist"]','input[placeholder*="Sanatçı"]') ||
      pick('#artist','input[name="coverArtist"]');

    let title =
      pick('#coverTitle','input[name="title"]','input[data-field="title"]','input[placeholder*="Şarkı"]','input[placeholder*="Parça"]') ||
      pick('#title','input[name="coverTitle"]');

    // fallback → prompttan çek
    if (!artist && !title) {
      const promptEl = document.querySelector("#coverPrompt");
      const promptText = promptEl?.value || "";
      const m = promptText.match(/^(.+?)\s+by\s+([a-zA-Z0-9 _-]+)/i);

      if (m) {
        title = m[1].trim();
        artist = m[2].trim();
      }
    }

    console.log("[cover overlay values]", { artist, title });

    if (!artist && !title) {
      return { ok: true, finalUrl: imageUrl };
    }

    const r = await fetch("/api/cover/overlay-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, artist, title }),
    });

    if (!r.ok) {
      return { ok: false, finalUrl: imageUrl };
    }

    const blob = await r.blob();
    const finalUrl = URL.createObjectURL(blob);

    return { ok: true, finalUrl };
  }


  if (window.__AIVO_COVER_MODULE__) return;
  window.__AIVO_COVER_MODULE__ = true;

  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function getRoot() {
    return document.querySelector('section.main-panel[data-module="cover"]');
  }

  function setActiveStyle(root, style) {
    if (!root || !style) return;

    qsa(".style-pill", root).forEach((b) => {
      const on = (b.getAttribute("data-style") || "") === style;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    qsa(".style-card", root).forEach((b) => {
      const on = (b.getAttribute("data-style") || "") === style;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    const card = root.querySelector(`.style-card[data-style="${CSS.escape(style)}"]`);
    const stylePrompt = card ? (card.getAttribute("data-prompt") || "").trim() : "";
    const ta = qs("#coverPrompt", root);

    if (ta && stylePrompt) {
      ta.value = stylePrompt;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }

    root.dataset.coverStyle = style;
    console.log("[cover] style =", style);
  }


  function setActiveQuality(root, quality) {
    if (!root) return;

    const q = String(quality || "artist").toLowerCase() === "ultra" ? "ultra" : "artist";

    qsa(".quality-pill", root).forEach((b) => {
      const on = (b.getAttribute("data-quality") || "") === q;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    root.dataset.coverQuality = q;

    const activeBtn = root.querySelector(`.quality-pill[data-quality="${CSS.escape(q)}"]`);
    const credit = Number(activeBtn?.getAttribute("data-credit-cost") || (q === "ultra" ? 9 : 6));

    const advStrong = root.querySelector(".advanced-credit strong");
    if (advStrong) advStrong.textContent = String(credit);

    const gen = qs("#coverGenerateBtn", root);
    if (gen) {
      gen.setAttribute("data-credit-cost", String(credit));
      gen.textContent = `🖼️ Kapak Üret (${credit} Kredi)`;
    }

    console.log("[cover] quality =", q);
  }


  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j) throw j?.error || `cover_failed_${r.status}`;
    if (j.ok === false) throw j.error || "cover_failed";

    return j;
  }


  function withTitleSafeArea(p) {
    const raw = String(p || "").trim();

    return [
      raw,
      "premium music cover artwork",
      "spotify and apple music quality album cover",
      "poster-quality composition with strong headline hierarchy",
      "design the image like a real commercial single cover",
      "reserve a clean title zone in the upper area",
      "avoid text artifacts and fake letters",
      "focus composition in the mid and lower sections",
      "cinematic lighting, premium color grading"
    ].join(", ");
  }


  async function generateImages({ prompt, n, quality }) {
    const tasks = [];

    for (let i = 0; i < n; i++) {

      const promptVar = n > 1 ? `${prompt} #${i + 1}` : prompt;
      const promptForModel = withTitleSafeArea(promptVar);

      tasks.push(
        postJSON("/api/providers/fal/predictions/create?app=cover", {
          input: {
            prompt: promptForModel,
            quality
          }
        }).then((j) => {

          const url =
            j.output ||
            j.imageUrl ||
            j.image_url ||
            j.url ||
            j.fal?.images?.[0]?.url ||
            null;

          return { url, prompt: promptVar };
        })
      );
    }

    return Promise.all(tasks);
  }


  async function createCover() {

    const root = getRoot();
    if (!root) return;

    const prompt = (qs("#coverPrompt", root)?.value || "").trim();
    if (!prompt) return alert("Lütfen görüntü açıklaması yaz.");

    const quality = root.dataset.coverQuality || "artist";
    const n = Number(qs("#coverCount", root)?.value || 1);

    const imgs = await generateImages({ prompt, n, quality });

    for (const img of imgs) {
      const over = await applyCoverTextOverlay(img.url);
      img.url = over.finalUrl;
    }

    const outputs = imgs.map((it, idx) => ({
      type: "image",
      url: it.url,
      index: idx,
      meta: {
        app: "cover",
        quality,
        prompt: it.prompt
      }
    }));

    window.PPE?.apply({
      state: "COMPLETED",
      outputs
    });

  }


  document.addEventListener("click", (e) => {

    const root = getRoot();
    if (!root) return;

    const qp = e.target.closest(".quality-pill");
    if (qp && root.contains(qp)) {
      e.preventDefault();
      setActiveQuality(root, qp.getAttribute("data-quality"));
      return;
    }

    const card = e.target.closest(".style-card");
    if (card && root.contains(card)) {
      e.preventDefault();
      setActiveStyle(root, card.getAttribute("data-style"));
      return;
    }

    const gen = e.target.closest("#coverGenerateBtn");
    if (gen && root.contains(gen)) {
      e.preventDefault();
      createCover().catch(console.error);
    }

  }, true);


  console.log("[COVER] module READY");

})();
