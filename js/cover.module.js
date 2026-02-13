// FILE: cover.module.js
console.log("[cover.module] loaded ✅", new Date().toISOString());

// cover.module.js — FULL BLOCK (style sync + quality routing + FAL generate + PPE.apply)
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

  function setActiveQuality(root, quality) {
    if (!root) return;
    const q = String(quality || "artist").toLowerCase() === "ultra" ? "ultra" : "artist";

    qsa(".quality-pill", root).forEach((b) => {
      const on = (b.getAttribute("data-quality") || "") === q;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    root.dataset.coverQuality = q;

    // UI: credit ve buton yazısını güncelle
    const activeBtn = root.querySelector(`.quality-pill[data-quality="${CSS.escape(q)}"]`);
    const credit = Number(activeBtn?.getAttribute("data-credit-cost") || (q === "ultra" ? 9 : 6)) || (q === "ultra" ? 9 : 6);

    const advStrong = root.querySelector(".advanced-credit strong");
    if (advStrong) advStrong.textContent = String(credit);

    const gen = qs("#coverGenerateBtn", root);
    if (gen) {
      gen.setAttribute("data-credit-cost", String(credit));
      gen.textContent = `🖼️ Kapak Üret (${credit} Kredi)`;
    }

    console.log("[cover] quality =", q, "credit =", credit);
  }

  // ✅ NUDGE: sayfa açılışında iki pill sırayla 1 kez “pulse” yapar, sonra biter.
  // (Artist seçili kalır. Kullanıcı tıklayınca otomatik durur.)
  function nudgeQualityPills(root) {
    if (!root || root.__qualityNudged) return;
    root.__qualityNudged = true;

    const artist = root.querySelector('.quality-pill[data-quality="artist"]');
    const ultra = root.querySelector('.quality-pill[data-quality="ultra"]');

    const styleId = "aivo-quality-nudge-style";
    if (!document.getElementById(styleId)) {
      const st = document.createElement("style");
      st.id = styleId;
      st.textContent = `
        @keyframes aivoPulse {
          0%   { box-shadow: 0 0 0 rgba(155,96,214,0.0), 0 0 0 rgba(155,96,214,0.0); transform: translateZ(0); }
          35%  { box-shadow: 0 0 0 2px rgba(155,96,214,0.25), 0 0 24px rgba(155,96,214,0.22); }
          70%  { box-shadow: 0 0 0 1px rgba(155,96,214,0.14), 0 0 14px rgba(155,96,214,0.14); }
          100% { box-shadow: 0 0 0 rgba(155,96,214,0.0), 0 0 0 rgba(155,96,214,0.0); }
        }
        .aivo-pulse-once { animation: aivoPulse 520ms ease-out 1; }
      `;
      document.head.appendChild(st);
    }

    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      [artist, ultra].forEach((el) => el && el.classList.remove("aivo-pulse-once"));
      root.removeEventListener("pointerdown", stop, true);
      root.removeEventListener("keydown", stop, true);
    };

    // kullanıcı ilk etkileşimde animasyonu kes
    root.addEventListener("pointerdown", stop, true);
    root.addEventListener("keydown", stop, true);

    const pulse = (el) => {
      if (!el || stopped) return;
      el.classList.remove("aivo-pulse-once"); // restart
      void el.offsetWidth; // reflow
      el.classList.add("aivo-pulse-once");
    };

    // Artist -> Ultra sıralı pulse
    pulse(artist);
    setTimeout(() => pulse(ultra), 340);
    setTimeout(stop, 1200); // garanti kapanış
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

  // n adet görsel için FAL create’i n kere çağır (sync url döner)
  async function generateImages({ prompt, style, ratio, n, quality }) {
    const tasks = [];
    for (let i = 0; i < n; i++) {
      const promptVar = n > 1 ? `${prompt} #${i + 1}` : prompt;

      // style/ratio şu an backend’te kullanılmıyor olabilir; meta olarak saklıyoruz.
      tasks.push(
        postJSON("/api/providers/fal/predictions/create?app=cover", {
          input: {
            prompt: promptVar,
            quality, // ✅ backend routing: artist | ultra
            // İstersen backend destekliyorsa buraya eklenebilir:
            // style,
            // ratio,
          },
        }).then((j) => {
          const url =
            j.output ||
            j.imageUrl ||
            j.image_url ||
            j.url ||
            j.fal?.images?.[0]?.url ||
            null;

          return {
            url,
            prompt: promptVar,
            raw: j,
          };
        })
      );
    }

    const results = await Promise.all(tasks);
    const urls = results.map((x) => x.url).filter(Boolean);
    if (!urls.length) {
      console.error("[cover] no image url from fal response", results);
      throw "cover_generate_no_image";
    }
    return results;
  }

  async function createCover() {
    const root = getRoot();
    if (!root) return;

    const prompt = (qs("#coverPrompt", root)?.value || "").trim();
    if (!prompt) return alert("Lütfen görüntü açıklaması yaz.");

    const style = root.dataset.coverStyle || null;
    const quality = root.dataset.coverQuality || "artist";
    const n = Number(qs("#coverCount", root)?.value || 1);
    const ratio = qs("#coverRatio", root)?.value || "1:1";

    console.log("[cover] generate request", { prompt, style, quality, n, ratio });

    const imgs = await generateImages({ prompt, style, ratio, n, quality });

    const outputs = imgs.map((it, idx) => ({
      type: "image",
      url: it.url,
      index: idx,
      meta: {
        app: "cover",
        quality,
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

      const qp = e.target.closest(".quality-pill");
      if (qp && root.contains(qp)) {
        e.preventDefault();
        const q = qp.getAttribute("data-quality") || "artist";
        setActiveQuality(root, q);
        return;
      }

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
            console.error("[cover] createCover error:", err);
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

  // default quality: artist (UI'da is-active olan varsa onu al)
  (function selectDefaultQuality() {
    const root = getRoot();
    if (!root) return;
    const active = root.querySelector(".quality-pill.is-active") || root.querySelector('.quality-pill[data-quality="artist"]');
    const q = active?.getAttribute("data-quality") || "artist";
    setActiveQuality(root, q);
  })();

  // ✅ Sayfa açılışında "buradayız hadi tıkla" pulse animasyonu
  (function nudgeOnBoot() {
    const root = getRoot();
    if (!root) return;
    nudgeQualityPills(root);
  })();

  bindPromptCounter();
  new MutationObserver(() => bindPromptCounter()).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  console.log("[COVER] module READY (style + quality + FAL create + PPE)");
})();
