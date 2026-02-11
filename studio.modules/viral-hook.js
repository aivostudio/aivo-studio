/* =========================================================
   AIVO — VIRAL HOOK (VIDEO) — RUNWAY ENGINE (FINAL / SAFE)
   - 4 adet kısa video hook üretir (slot 0..3)
   - Global gate/credit sistemi ile uyumlu (biz burada kredi düşürmeyiz)
   - Double-trigger korumalı
   - Çıktıları panel.hook.js’e düşürmek için PPE.onOutput kullanır
   ========================================================= */

(function () {
  "use strict";

  // ✅ BIND ONCE
  if (window.__AIVO_VIRAL_HOOK_VIDEO_BOUND__) return;
  window.__AIVO_VIRAL_HOOK_VIDEO_BOUND__ = true;

  // ---- Config ----
  const APP_KEY = "hook"; // panel.hook.js isHook() bunu görüyor
  const SLOTS = 4;
  const POLL_MS = 1200;
  const POLL_MAX_TRIES = 180; // ~3.5 dk

  // ---- Helpers ----
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const safeStr = (v) => String(v == null ? "" : v).trim();

  function getPrompt() {
    // sayfada input id’si değişirse buraya ekle
    const el =
      document.getElementById("viralHookInput") ||
      qs('[data-viral-hook-input]') ||
      qs('input[name="viralHookInput"]') ||
      qs("input.viralHookInput") ||
      qs("textarea#viralHookInput") ||
      qs("textarea.viralHookInput");
    return el ? safeStr(el.value) : "";
  }

  function getSelectedStyle() {
    const active = document.querySelector(".style-card.is-active");
    return active ? safeStr(active.dataset.style) : "Viral";
  }

  function toast(type, message) {
    // Sizde toast.manager.js var; varsa onu kullanır, yoksa console
    try {
      if (window.Toast?.show) return window.Toast.show({ type, message });
      if (window.toast?.show) return window.toast.show({ type, message });
      if (window.showToast) return window.showToast(type, message);
    } catch {}
    console.log(`[TOAST:${type}]`, message);
  }

  function emitOutput(slotIndex, videoUrl, metaExtra) {
    if (!window.PPE || typeof PPE.onOutput !== "function") return;

    const job = {
      app: APP_KEY,
      state: "COMPLETED",
      job_id: metaExtra?.job_id || `HOOK_${Date.now()}_${slotIndex}`,
      meta: { app: APP_KEY },
    };

    const out = {
      type: "video",
      url: videoUrl,
      index: slotIndex,
      meta: { app: APP_KEY, ...metaExtra },
    };

    // panel.hook.js slotları buradan doluyor
    PPE.onOutput(job, out);
  }

  // ---- UI: style selection (aynı kalabilir) ----
  document.addEventListener("click", function (e) {
    const card = e.target.closest(".style-card");
    if (!card) return;

    qsa(".style-card.is-active").forEach((c) => c.classList.remove("is-active"));
    card.classList.add("is-active");
  });

  // ---- Runway API wrappers ----
  async function runwayCreate(payload) {
    // Sende providers/runway/video/create.js var.
    // Backend route: /api/providers/runway/video/create
    const res = await fetch("/api/providers/runway/video/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      const msg = json?.error || json?.message || `runway_create_failed (${res.status})`;
      throw new Error(msg);
    }
    return json;
  }

  async function runwayStatus(requestId) {
    // Backend route: /api/providers/runway/video/status?request_id=...
    const url = `/api/providers/runway/video/status?request_id=${encodeURIComponent(requestId)}`;
    const res = await fetch(url, { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      const msg = json?.error || json?.message || `runway_status_failed (${res.status})`;
      throw new Error(msg);
    }
    return json;
  }

  function pickVideoUrl(statusJson) {
    // farklı provider cevap formatlarını tolere eder
    return (
      statusJson?.output?.url ||
      statusJson?.output_url ||
      statusJson?.video_url ||
      statusJson?.result?.url ||
      statusJson?.result?.video_url ||
      (Array.isArray(statusJson?.outputs) ? statusJson.outputs?.[0]?.url : null) ||
      (Array.isArray(statusJson?.videos) ? statusJson.videos?.[0]?.url : null) ||
      null
    );
  }

  function pickState(statusJson) {
    // succeeded/completed/processing/failed gibi varyantlar
    return (
      safeStr(statusJson?.status || statusJson?.state || statusJson?.data?.status).toLowerCase() ||
      ""
    );
  }

  function buildPrompt(basePrompt, style, slotIndex) {
    // Hook için “wow” prompt şablonu — kısa, yoğun, camera action
    // slotIndex ile varyasyon veriyoruz
    const variants = [
      "ultra dynamic, fast zoom-in, punchy, high contrast",
      "cinematic, handheld, quick cuts, dramatic lighting",
      "product hero shot, smooth dolly, glossy highlights",
      "viral tiktok style, bold motion, satisfying loop",
    ];
    const vibe = variants[slotIndex % variants.length];

    return `${style} viral hook video. ${vibe}. Subject: ${basePrompt}. 3-7 seconds.`;
  }

  // ---- Concurrency guard ----
  let RUNNING = false;

  // ---- Generate button ----
  document.addEventListener(
    "click",
    async function (e) {
      const btn = e.target.closest("[data-generate-viral-hook]");
      if (!btn) return;

      // ⚠️ SADECE preventDefault — global gate (credits) çalışsın
      e.preventDefault();

      if (RUNNING) return;
      RUNNING = true;

      try {
        const prompt = getPrompt();
        if (!prompt) {
          toast("warning", "Önce konu/mesaj yazmalısın.");
          return;
        }

        const style = getSelectedStyle();

        // paneli aç (güzel UX)
        try { window.RightPanel?.force?.("hook"); } catch {}

        toast("info", "Hook videolar hazırlanıyor…");

        // 4 adet create
        const creates = [];
        for (let i = 0; i < SLOTS; i++) {
          const p = buildPrompt(prompt, style, i);

          // Runway create payload: backend’in beklediği alanlar değişebilir.
          // Burayı intentionally “genel” tuttuk.
          creates.push(
            runwayCreate({
              app: APP_KEY,
              prompt: p,
              duration: 4, // 3-7 arası; backend destekliyorsa
              aspect_ratio: "9:16",
              // seed: optional
              meta: { slot: i, app: APP_KEY },
            }).then((j) => ({ slot: i, json: j }))
          );
        }

        const created = await Promise.allSettled(creates);

        // request_id topla
        const reqs = [];
        created.forEach((r) => {
          if (r.status !== "fulfilled") return;
          const slot = r.value.slot;
          const j = r.value.json;

          const requestId =
            j?.request_id || j?.id || j?.prediction_id || j?.data?.id || j?.data?.request_id;

          if (requestId) reqs.push({ slot, requestId });
        });

        if (!reqs.length) throw new Error("Runway create request_id üretmedi.");

        // Poll hepsini paralel götür
        await Promise.all(
          reqs.map(async ({ slot, requestId }) => {
            let tries = 0;

            while (tries++ < POLL_MAX_TRIES) {
              const st = await runwayStatus(requestId);
              const state = pickState(st);

              if (state.includes("fail") || state.includes("error") || st?.error) {
                throw new Error(st?.error || `slot ${slot} failed`);
              }

              if (state.includes("succeed") || state.includes("complete") || state === "done") {
                const url = pickVideoUrl(st);
                if (!url) throw new Error(`slot ${slot} video_url missing`);
                emitOutput(slot, url, { request_id: requestId, slot });
                return;
              }

              await new Promise((r) => setTimeout(r, POLL_MS));
            }

            throw new Error(`slot ${slot} timeout`);
          })
        );

        toast("success", "4 Hook video hazır ✅");
      } catch (err) {
        toast("error", `Hook üretim hatası: ${err?.message || err}`);
        console.error("[HOOK_RUNWAY]", err);
      } finally {
        RUNNING = false;
      }
    },
    true // capture açık, gate ile uyumlu
  );
})();
<!-- 🔌 ÜRÜN MODÜLLERİ -->
<script src="/studio.modules/viral-hook.js?v=1"></script>
<script src="/studio.modules/socialpack.js?v=1"></script>

<!-- LEGACY (en son, dokunmuyoruz) -->
<script src="/studio.js?v=999"></script>
