// FILE: cover.module.js
console.log("[cover.module] loaded ✅", new Date().toISOString());

// cover.module.js — FULL BLOCK (style sync + quality routing + FAL generate + PPE.apply)
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

    const artist =
      pick('#coverArtist', 'input[name="artist"]', 'input[data-field="artist"]', 'input[placeholder*="Sanatçı"]') ||
      pick('#artist', 'input[name="coverArtist"]');

    const title =
      pick('#coverTitle', 'input[name="title"]', 'input[data-field="title"]', 'input[placeholder*="Şarkı"]', 'input[placeholder*="Parça"]') ||
      pick('#title', 'input[name="coverTitle"]');

    console.log("[cover overlay values]", { artist, title });

    if (!artist && !title) return { ok: true, finalUrl: imageUrl };

    console.log("[cover overlay payload]", { imageUrl, artist, title });

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

  function shouldApplyCoverTextOverlay() {
    return false;
  }

  if (window.__AIVO_COVER_MODULE__) return;
  window.__AIVO_COVER_MODULE__ = true;

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

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
    const credit =
      Number(activeBtn?.getAttribute("data-credit-cost") || (q === "ultra" ? 9 : 6)) ||
      (q === "ultra" ? 9 : 6);

    const advStrong = root.querySelector(".advanced-credit strong");
    if (advStrong) advStrong.textContent = String(credit);

    const gen = qs("#coverGenerateBtn", root);
    if (gen) {
      gen.setAttribute("data-credit-cost", String(credit));
      gen.textContent = `🖼️ Kapak Üret (${credit} Kredi)`;
    }

    console.log("[cover] quality =", q, "credit =", credit);
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

  // --- COVER PROMPT COMPOSITION: premium title-friendly cover layout ---
  function withTitleSafeArea(p) {
    const raw = String(p || "").trim();

    return [
      raw,
      "premium music cover artwork",
      "spotify and apple music quality album cover",
      "real commercial single cover design",
      "clean balanced composition",
      "strong focal subject",
      "cinematic lighting",
      "premium color grading",
      "polished depth",
      "minimal clutter",
      "no text",
      "no typography",
      "no letters",
      "no words",
      "no logo",
      "no watermark",
      "no fake text",
      "no random characters",
    ].join(", ");
  }

function buildCoverPrompt(prompt, quality) {
  const raw = String(prompt || "").trim();
  const q = String(quality || "artist").toLowerCase();

  if (!raw) {
    return withTitleSafeArea("");
  }

  const safeBase = withTitleSafeArea(raw);

  if (q !== "ultra") {
    return safeBase;
  }

  const shortPrompt = raw.length <= 40 && !/[,.]/.test(raw);
  const multiSubject =
    /\b(ve|ile|izleyen|bakan|karşı|arasında|yanında|üstünde|altında|içinde)\b/i.test(raw);

  if (shortPrompt && !multiSubject) {
    return [
      `Kapak görseli için ana özne yalnızca ${raw} olsun.`,
      `Görselin merkezinde net, baskın ve gerçekçi şekilde ${raw} yer alsın.`,
      "Başka hayvan, insan, insan yüzü, kadın, erkek, portre, manzara veya alakasız nesne olmasın.",
      `${raw} doğal ortamında görünsün.`,
      "Sinematik ışık, premium renkler, temiz kompozisyon, yüksek detay, kapak tasarımına uygun güçlü odak olsun.",
      "Yazı, harf, logo, watermark, tipografi olmasın.",
      safeBase
    ].join(" ");
  }

  if (multiSubject) {
    return [
      "Kapak görselinde kullanıcı isteğine sadık kal.",
      `İstenen sahne şudur: ${raw}.`,
      "Tüm özneleri ve aralarındaki ilişkiyi tek sahnede koru.",
      "Hiçbir özneyi çıkarma, başka bir ana özne icat etme.",
      "İnsan, kadın yüzü, portre veya alakasız karakter ekleme; yalnızca promptta açıkça varsa kullan.",
      "Kompozisyon net olsun, ana aksiyon anlaşılır olsun, sahne dağılmasın.",
      "Sinematik ışık, premium renkler, temiz cover kompozisyonu, yüksek detay olsun.",
      "Yazı, harf, logo, watermark, tipografi olmasın.",
      safeBase
    ].join(" ");
  }

  return [
    `Kullanıcı isteğine sadık kal: ${raw}.`,
    "Ana özneyi doğru koru, alakasız özne üretme.",
    "İnsan yüzü, portre, kadın, erkek veya alakasız manzara ekleme; prompt açıkça istemiyorsa kullanma.",
    "Temiz, güçlü, premium cover kompozisyonu üret.",
    "Yazı, harf, logo, watermark, tipografi olmasın.",
    safeBase
  ].join(" ");
}

  // n adet görsel için FAL create’i n kere çağır (sync url döner)
  async function generateImages({ prompt, style, ratio, n, quality }) {
    const tasks = [];

    for (let i = 0; i < n; i++) {
      const promptVar = n > 1 ? `${prompt} #${i + 1}` : prompt;
      const promptForModel = buildCoverPrompt(promptVar, quality);

      console.log("[cover] promptForModel", {
        quality,
        promptVar,
        promptForModel,
      });

      tasks.push(
        postJSON("/api/providers/fal/predictions/create?app=cover", {
          input: {
            prompt: promptForModel,
            quality,
            ratio,
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

    for (const img of imgs) {
      console.log("[cover overlay start]", img.url);

      const originalImageUrl = img.url;
      let displayImageUrl = img.url;

      if (shouldApplyCoverTextOverlay()) {
        const over = await applyCoverTextOverlay(img.url);
        if (over?.finalUrl) {
          displayImageUrl = over.finalUrl;
        }
      }

      try {
        const db = await postJSON("/api/cover/generate", {
          prompt: img.prompt || prompt,
          style,
          quality,
          ratio,
          imageUrl: originalImageUrl,
        });

        console.log("[cover] db saved ✅", db);

        if (db?.job_id) {
          window.dispatchEvent(
            new CustomEvent("aivo:cover:job_created", {
              detail: {
                app: "cover",
                job_id: db.job_id,
                prompt: img.prompt || prompt,
                quality,
                style,
                ratio,
                imageUrl: displayImageUrl,
                createdAt: Date.now(),
                meta: {
                  app: "cover",
                  prompt: img.prompt || prompt,
                  quality,
                  style,
                  ratio,
                  originalImageUrl,
                },
              },
            })
          );
        }
      } catch (e) {
        console.error("[cover] db write failed", e);
      }
    }
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
      Array.from(root.querySelectorAll("*")).find((el) => (el.textContent || "").trim() === "0 / 1000");

    if (!counterEl) return;

    promptEl.__countBound = true;

    function update() {
      const n = (promptEl.value || "").length;
      counterEl.textContent = `${n} / 1000`;
    }

    promptEl.addEventListener("input", update);
    promptEl.addEventListener("change", update);
    update();
  }

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

  (function selectDefaultStyle() {
    const root = getRoot();
    if (!root) return;
    const first = qs(".style-card[data-style]", root);
    if (first) setActiveStyle(root, first.getAttribute("data-style"));
  })();

  (function selectDefaultQuality() {
    const root = getRoot();
    if (!root) return;
    setActiveQuality(root, "artist");
  })();

  bindPromptCounter();

  function ensureDefaultCoverQuality() {
    const root = getRoot();
    if (!root) return;

    const artist = root.querySelector('.quality-pill[data-quality="artist"]');
    if (!artist) return;

    const hasSelected = root.querySelector('.quality-pill[aria-pressed="true"]');
    if (!hasSelected) {
      setActiveQuality(root, "artist");
    }
  }

  ensureDefaultCoverQuality();

  new MutationObserver(() => {
    bindPromptCounter();
    ensureDefaultCoverQuality();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  console.log("[COVER] module READY (style + quality + FAL create + PPE)");
})();
