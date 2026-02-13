console.log("[cover.module] loaded ✅", new Date().toISOString());

// cover.module.js — FULL BLOCK (style sync + create + poll + PPE.apply)
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

    // seçilen kartın data-prompt'unu prompt textarea'ya basalım
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
    if (!r.ok || !j) throw j?.error || `cover_request_failed_${r.status}`;
    if (j.ok === false) throw j.error || "cover_request_failed";
    return j;
  }

  async function pollJob(job_id) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}&app=cover`);
      const j = await r.json().catch(() => null);
      if (!j || !j.ok) continue;

      const st = String(j.status || "").toLowerCase();

      if ((st === "ready" || st === "completed") && Array.isArray(j.outputs) && j.outputs.length) {
        window.PPE?.apply({
          state: "COMPLETED",
          outputs: j.outputs,
        });
        console.log("[cover] PPE.apply done", job_id);
        return;
      }

      if (st === "failed" || st === "error") {
        throw "cover_failed";
      }
    }
    throw "cover_poll_timeout";
  }

  async function createCover() {
    const root = getRoot();
    if (!root) return;

    const prompt = (qs("#coverPrompt", root)?.value || "").trim();
    if (!prompt) return alert("Lütfen görüntü açıklaması yaz.");

    const style = root.dataset.coverStyle || null;

    const payload = {
      prompt,
      style,
      n: Number(qs("#coverCount", root)?.value || 1),
      ratio: qs("#coverRatio", root)?.value || "1:1",
    };

    // ✅ api/jobs/create.js body.type bekliyor (app değil)
    // ✅ prompt + params kullanıyor
    const j = await postJSON("/api/jobs/create", {
      type: "cover",
      provider: "fal",
      prompt: payload.prompt,
      params: payload,
    });

    // ✅ endpoint { ok:true, job_id } dönüyor
    const job_id = j.job_id;
    if (!job_id) throw "cover_job_id_missing";

    // ✅ diğer bölümleri bozmamak için sadece min job upsert (ekleme)
    const job = {
      job_id,
      app: "cover",
      status: "queued",
      provider: "fal",
      prompt: payload.prompt,
      meta: payload,
      created_at: Date.now(),
    };
    window.AIVO_JOBS?.upsert?.(job);

    console.log("[cover] created", job);

    pollJob(job_id).catch(console.error);
  }

  // --- PROMPT CHAR COUNT (0/480) ---
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

      if (e.target.closest("#coverGenerateBtn")) {
        e.preventDefault();

        const btn = e.target.closest("#coverGenerateBtn");
        btn.disabled = true;
        const prev = btn.textContent;
        btn.textContent = "Üretiliyor...";
        btn.classList.add("is-loading");

        createCover()
          .catch((err) => {
            console.error(err);
            alert(String(err));
          })
          .finally(() => {
            btn.disabled = false;
            btn.textContent = prev;
            btn.classList.remove("is-loading");
          });

        return;
      }
    },
    true
  );

  // default style seç (ilk kart)
  (function selectDefaultStyle() {
    const root = getRoot();
    if (!root) return;
    const first = qs(".style-card[data-style]", root);
    if (first) setActiveStyle(root, first.getAttribute("data-style"));
  })();

  // geç mount / router için
  bindPromptCounter();
  new MutationObserver(() => bindPromptCounter()).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  console.log("[COVER] module READY (style + create + poll + PPE)");
})();
