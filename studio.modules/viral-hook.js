/* =========================================================
   AIVO — VIRAL HOOK MODULE (FINAL / RUNWAY VIDEO)
   - Hook artık TEXT değil VIDEO üretir
   - Runway create + status poll
   - PPE.apply ile RightPanel slotlara düşürür
   - KREDİ DÜŞÜRME YOK (GLOBAL GATE / BACKEND TEK OTORİTE)
   - DOUBLE TRIGGER YOK
   ========================================================= */

(function () {
  "use strict";

  // ✅ BIND ONCE
  if (window.__AIVO_VIRAL_HOOK_BOUND__) return;
  window.__AIVO_VIRAL_HOOK_BOUND__ = true;

  // -----------------------
  // Helpers
  // -----------------------
  const safeStr = (v) => String(v == null ? "" : v).trim();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function getPrompt() {
    const el = document.getElementById("viralHookInput");
    return el ? safeStr(el.value) : "";
  }

  function getSelectedStyle() {
    const active = document.querySelector(".style-card.is-active");
    return active ? safeStr(active.dataset.style) : "Viral";
  }

  function toast(msg, type) {
    try {
      if (window.Toast && typeof window.Toast.show === "function") {
        return window.Toast.show(msg, type || "info");
      }
      if (window.AIVO_TOAST && typeof window.AIVO_TOAST === "function") {
        return window.AIVO_TOAST(msg);
      }
    } catch {}
    console.log("[HOOK]", msg);
  }

  function ensureRightPanelHookOpen() {
    try {
      if (window.RightPanel && typeof RightPanel.force === "function") {
        RightPanel.force("hook");
      }
    } catch {}
  }

  function ppeApply(job, outputUrl, index) {
    if (!window.PPE || typeof PPE.apply !== "function") return;

    PPE.apply({
      job,
      outputs: [
        {
          type: "video",
          url: outputUrl,
          index,
          meta: { app: "hook" }
        }
      ]
    });
  }

  // -----------------------
  // API calls
  // -----------------------
  async function createHookVideo({ prompt, style, index }) {
    // app parametresi önemli: backend job.app = "hook" olmalı
    const url = `/api/providers/runway/video/create?app=hook`;

    const payload = {
      prompt,
      style,
      index,
      // ekstra: ileride duration/aspect vs eklenebilir
      // duration: 5,
      // aspect_ratio: "9:16"
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || "runway_create_failed");
    }

    // beklenen: { ok:true, job_id:"..." }
    const job_id = json.job_id || json.id || json.request_id;
    if (!job_id) throw new Error("missing_job_id");

    return {
      job_id,
      raw: json,
    };
  }

  async function pollHookVideo(job_id) {
    const url = `/api/providers/runway/video/status?job_id=${encodeURIComponent(job_id)}&app=hook`;

    const res = await fetch(url, { method: "GET" });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || "runway_status_failed");
    }

    // beklenen: { ok:true, status:"processing" | "succeeded" | "failed", output:"...mp4" }
    return json;
  }

  // -----------------------
  // Hook generation pipeline
  // -----------------------
  async function runOneHookSlot(prompt, style, index) {
    // create
    const created = await createHookVideo({ prompt, style, index });
    const job_id = created.job_id;

    // job objesi (panel filtre için app=hook şart)
    const job = {
      job_id,
      app: "hook",
      module: "hook",
      routeKey: "hook",
      index,
      prompt,
      style,
      created_at: Date.now(),
    };

    // store'a bas (panel/job tracking için)
    try {
      if (window.AIVO_JOBS && typeof window.AIVO_JOBS.upsert === "function") {
        window.AIVO_JOBS.upsert(job);
      }
    } catch {}

    // poll
    const maxTries = 120; // ~4 dk (2s)
    for (let i = 0; i < maxTries; i++) {
      await sleep(2000);

      const st = await pollHookVideo(job_id);

      const status = safeStr(st.status || st.state || "").toLowerCase();

      if (status === "failed" || status === "error" || st.error) {
        throw new Error(st.error || "hook_failed");
      }

      if (status === "succeeded" || status === "completed" || st.output) {
        const outUrl =
          st.output ||
          st.url ||
          st.video_url ||
          st.result?.url ||
          (Array.isArray(st.outputs) ? st.outputs?.[0]?.url : null);

        if (!outUrl) throw new Error("missing_output_url");

        // PPE bas -> panel.hook slot doldurur
        ppeApply(job, outUrl, index);

        return { job, url: outUrl };
      }
    }

    throw new Error("hook_timeout");
  }

  async function generateHookPack(prompt, style) {
    ensureRightPanelHookOpen();

    toast("🎣 Hook videoları üretiliyor...", "info");

    // 4 slot: 0,1,2,3
    // paralel çalıştırabiliriz ama runway rate limit olabilir.
    // o yüzden sırayla daha stabil.
    const results = [];

    for (let i = 0; i < 4; i++) {
      try {
        toast(`⚡ Hook #${i + 1} hazırlanıyor...`, "info");
        const r = await runOneHookSlot(prompt, style, i);
        results.push(r);
      } catch (err) {
        console.warn("Hook slot failed:", i, err);
        toast(`❌ Hook #${i + 1} üretilemedi`, "error");
      }
    }

    if (results.length > 0) {
      toast("✅ Hook videoları hazır!", "success");
    } else {
      toast("❌ Hook üretimi başarısız oldu.", "error");
    }

    return results;
  }

  // -----------------------
  // Style selection
  // -----------------------
  document.addEventListener("click", function (e) {
    const card = e.target.closest(".style-card");
    if (!card) return;

    document
      .querySelectorAll(".style-card.is-active")
      .forEach((c) => c.classList.remove("is-active"));

    card.classList.add("is-active");
  });

  // -----------------------
  // Generate button
  // -----------------------
  document.addEventListener(
    "click",
    async function (e) {
      const btn = e.target.closest("[data-generate-viral-hook]");
      if (!btn) return;

      // ⚠️ SADECE preventDefault — global gate çalışsın
      e.preventDefault();

      const prompt = getPrompt();
      if (!prompt) {
        toast("Prompt boş olamaz.", "error");
        return;
      }

      const style = getSelectedStyle();

      // double click lock
      if (btn.dataset.busy === "1") return;
      btn.dataset.busy = "1";

      try {
        btn.classList.add("is-loading");
      } catch {}

      try {
        await generateHookPack(prompt, style);
      } catch (err) {
        console.error("HOOK ERROR:", err);
        toast("❌ Hook üretiminde hata oluştu.", "error");
      } finally {
        btn.dataset.busy = "0";
        try {
          btn.classList.remove("is-loading");
        } catch {}
      }
    },
    true // capture açık, gate ile uyumlu
  );
})();
