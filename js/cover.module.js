console.log("[cover.module] loaded ✅", new Date().toISOString());

// cover.module.js — FULL BLOCK (style sync + generate mock + PPE.apply)
(function () {
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

    // seçilen kartın data-prompt'u varsa prompt alanına basalım
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

  // n adet görsel için generate’i n kere çağır (şimdilik mock)
  async function generateImages({ prompt, style, ratio, n }) {
    const tasks = [];
    for (let i = 0; i < n; i++) {
      // picsum seed farklı olsun diye prompt’a suffix ekleyelim
      const promptVar = n > 1 ? `${prompt} #${i + 1}` : prompt;

      tasks.push(
        postJSON("/api/cover/generate", {
          prompt: promptVar,
          style,
          ratio,
          n: 1,
        }).then((j) => ({
          url: j.imageUrl || j.image_url || j.url || null,
          prompt: j.prompt || promptVar,
        }))
      );
    }

    const results = await Promise.all(tasks);
    const urls = results.map((x) => x.url).filter(Boolean);
    if (!urls.length) throw "cover_generate_no_image";
    return results;
  }

  async function createCover() {
    const root = getRoot();
    if (!root) return;

    const prompt = (qs("#coverPrompt", root)?.value || "").trim();
    if (!prompt) return alert("Lütfen görüntü açıklaması yaz.");

    const style = root.dataset.coverStyle || null;
    const n = Number(qs("#coverCount", root)?.value || 1);
    const ratio = qs("#coverRatio", root)?.value || "1:1";

    console.log("[cover] generate request", { prompt, style, n, ratio });

    // MOCK generate → PPE.apply
    const imgs = await generateImages({ prompt, style, ratio, n });

    const outputs = imgs.map((it, idx) => ({
      type: "image",
      url: it.url,
      index: idx,
      meta: {
        app: "cover",
        style: style || undefined,
        ratio,
        prompt: it.prompt,
      },
    }));

    window.PPE?.apply({
      state: "COMPLETED",
      outputs,
    });

    console.log("[cover] PPE.apply ✅", outputs);
  }

  // --- PROMPT CHAR COUNT (opsiyonel) ---
  function bindPromptCounter() {
    const root = getRoot();
    if (!root) return;

    const promptEl = qs("#coverPrompt", root);
    if (!promptEl || promptEl.__countBound) return;

    const counterEl =
      qs("#coverPromptCount", root) ||
      qs('[data-role="coverPromptCount"]', root) ||
      Array.from(root.querySelectorAll("*")).find((el) => (el.textContent || "").trim() === "0 / 480");

    if (!counterEl) return;

    promptEl.__countBound = true;

    function update() {
      const n = (promptEl.value || "").length;
      counterEl.textContent = `${n} / 480`;
    }

    promptEl.addEventListener("input", update);
    promptEl.addEventListener("change", update);
    update();
  }

  // Click delegation
  document.addEventListener(
    "click",
    (e) => {
      const root = getRoot();
      if (!root) return;

      const pill = e.target.closest(".style-pill");
      if (pill && root.contains(pill)) {
        e.preventDefault();
        const style = pill.getAttribute("data-style");
        setActiveStyle(root, style);
        return;
      }

      const card = e.target.closest(".style-card");
      if (card && root.contains(card)) {
        e.preventDefault();
        const style = card.getAttribute("data-style");
        setActiveStyle(root, style);
        return;
      }

      const gen = e.target.closest("#coverGenerateBtn");
      if (gen && root.contains(gen)) {
        e.preventDefault();

        gen.disabled = true;
        const prev = gen.textContent;
        gen.textContent = "Üretiliyor...";
        gen.classList.add("is-loading");

        createCover()
          .catch((err) => {
            console.error(err);
            alert(String(err));
          })
          .finally(() => {
            gen.disabled = false;
            gen.textContent = prev;
            gen.classList.remove("is-loading");
          });

        return;
      }
    },
    true
  );

  // default style: ilk kart
  (function selectDefaultStyle() {
    const root = getRoot();
    if (!root) return;
    const first = qs(".style-card[data-style]", root);
    if (first) setActiveStyle(root, first.getAttribute("data-style"));
  })();

  bindPromptCounter();
  new MutationObserver(() => bindPromptCounter()).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  console.log("[COVER] module READY (style + /api/cover/generate + PPE)");
})();
