// =========================================================
// ✅ AIVO_APP.generateMusic — SERVICE (CREDITS + JOB + GENERATE)
// File: /js/studio.services.js
// - Kredi tüketir (consume)
// - Üst bar krediyi anında günceller (#topCreditCount)
// - Job create eder
// - /api/music/generate fire-and-forget
// =========================================================

window.AIVO_APP = window.AIVO_APP || {};

(function __AIVO_SERVICES_MUSIC__() {
  if (window.__AIVO_SERVICES_MUSIC__) return;
  window.__AIVO_SERVICES_MUSIC__ = true;

  function setTopCreditsUI(nextCredits) {
    const n = document.querySelector("#topCreditCount");
    if (!n) return;
    n.textContent = String(nextCredits);
  }

  async function consumeCredits(cost, meta) {
    const res = await fetch("/api/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        cost: Number(cost) || 0,
        reason: "studio_music_generate",
        meta: meta || {}
      })
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      return { ok: false, status: res.status, data };
    }

    const credits =
      (data && (data.credits ?? data.remainingCredits ?? data.balance)) ??
      null;

    return { ok: true, status: res.status, data, credits };
  }

  async function createJob(type, extraBody) {
    const jr = await fetch("/api/jobs/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...(extraBody || {}) })
    });

    let jobData = null;
    try { jobData = await jr.json(); } catch (_) {}

    if (!jr.ok || !jobData?.job_id) {
      throw new Error(jobData?.error || "job_create_failed");
    }
    return jobData.job_id;
  }

  window.AIVO_APP.generateMusic = async function ({ prompt, cost = 5 } = {}) {
    const p = String(prompt || "").trim();
    if (!p) throw new Error("Prompt boş");

    // 1) Credit consume (tek otorite)
    const cr = await consumeCredits(cost, { promptLen: p.length });
    if (!cr.ok) {
      window.toast?.error?.("Yetersiz kredi.");
      const to = encodeURIComponent(location.pathname + location.search + location.hash);
      location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" + to;
      return { ok: false, error: "insufficient_credit" };
    }

    if (typeof cr.credits === "number") {
      setTopCreditsUI(cr.credits);
    }

    // 2) Job create
    const job_id = await createJob("music", { credit_cost: cost });

    // 3) Generate (fire-and-forget)
    fetch("/api/music/generate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id, prompt: p })
    }).catch(() => {});

    return { ok: true, job_id, credits: cr.credits ?? null };
  };
})();
/* ============================================================================
   ✅ ATM_CREATE HOOK (SINGLE SOURCE) — studio.services.js (bottom)
   - Atmosfer Üret butonundan gelen payload'ı normalize eder
   - Duration FORCE YOK ✅ (UI seçimi aynen gider)
   - Aspect Ratio: 16:9 / 1:1 / 9:16 (default 16:9)
   - /api/jobs/create-atmo çağırır
   - job_id gelince "aivo:atmo:job_created" event fırlatır (Video hissi)
   - PPE.apply / AIVO_JOBS.upsert ile kart basmaz (dupe biter)
   - ✅ FIX: double click / double fire -> inflight lock (2 video biter)
   ============================================================================ */

(() => {
  if (window.__ATM_CREATE_BOUND__) return;
  window.__ATM_CREATE_BOUND__ = true;

  const safeJson = async (res) => {
    const txt = await res.text().catch(() => "");
    try { return JSON.parse(txt || "{}"); }
    catch { return { ok:false, error:"bad_json", raw: txt }; }
  };

  const nowISO = () => new Date().toISOString();

  const ALLOWED_DURS = new Set(["4", "6", "8", "10", "12", "15"]);
  const ALLOWED_RATIOS = new Set(["16:9", "1:1", "9:16"]);

  const normalizeRatio = (raw) => {
    const r = String(raw || "").trim();
    if (ALLOWED_RATIOS.has(r)) return r;

    // toleranslı girişler (16x9, 16/9, 169 vs)
    const n = r.replaceAll(" ", "").replaceAll("/", ":").replaceAll("x", ":").toLowerCase();
    if (n === "16:9" || n === "169") return "16:9";
    if (n === "1:1" || n === "11") return "1:1";
    if (n === "9:16" || n === "916") return "9:16";

    // ürün default
    return "16:9";
  };

  const normalizePayload = (p) => {
    const payload = { ...(p || {}) };

    payload.app = "atmo";
    payload.mode = payload.mode || "basic";

    // duration: UI ne verdiyse o (whitelist + fallback)
    const rawDur = payload.duration ?? payload.proDuration ?? null;
    const dur = String(rawDur || "").trim();
    payload.duration = ALLOWED_DURS.has(dur) ? dur : "8";

    // ✅ aspect_ratio: UI seçimi veya default 16:9
    payload.aspect_ratio = normalizeRatio(payload.aspect_ratio || payload.ratio || payload.aspect || "");

    // bazı wrapper’lar ratio bekliyor, ikisini de koyuyoruz
    payload.ratio = payload.aspect_ratio;

    // defaults
    payload.format = payload.format || "mp4";
    payload.fps = payload.fps || "24";

    // seamFix -> seam_fix
    if (payload.seamFix != null && payload.seam_fix == null) {
      payload.seam_fix = !!payload.seamFix;
      delete payload.seamFix;
    }

    // normalize prompt
    if (payload.text && !payload.prompt) {
      payload.prompt = String(payload.text || "");
      delete payload.text;
    }
    payload.prompt = String(payload.prompt || "").trim();

    return payload;
  };

  const dispatchJobCreated = (job_id, payload) => {
    try {
      window.dispatchEvent(new CustomEvent("aivo:atmo:job_created", {
        detail: {
          job_id: String(job_id),
          app: "atmo",
          createdAt: nowISO(),
          meta: {
            app: "atmo",
            mode: payload.mode || "basic",
            duration: payload.duration || "8",
            fps: payload.fps || "24",
            format: payload.format || "mp4",
            aspect_ratio: payload.aspect_ratio || "16:9",
            ratio: payload.aspect_ratio || "16:9",

            // ekstra debug/meta
            prompt: payload.prompt || "",
            scene: payload.scene || "",
            effects: Array.isArray(payload.effects) ? payload.effects.slice() : [],
            camera: payload.camera || ""
          }
        }
      }));
    } catch (e) {
      console.warn("[ATM_CREATE] job_created event fail:", e);
    }
  };

  window.ATM_CREATE = async function ATM_CREATE(inPayload) {
    // ✅ anti-double-submit lock
    if (window.__ATM_CREATE_INFLIGHT__) {
      console.warn("[ATM_CREATE] blocked (inflight)");
      return { ok:false, error:"inflight" };
    }
    window.__ATM_CREATE_INFLIGHT__ = true;

    try {
      const payload = normalizePayload(inPayload);

      console.log("[ATM_CREATE] -> create-atmo", payload);

      let res = null;
      try {
        res = await fetch("/api/jobs/create-atmo", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error("[ATM_CREATE] fetch failed:", e);
        return { ok:false, error:"network_error" };
      }

      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) {
        console.error("[ATM_CREATE] create-atmo failed:", res.status, data);
        return { ok:false, status:res.status, ...data };
      }

      const job_id = data.job_id || data.id || data.jobId;
      console.log("[ATM_CREATE] created job_id =", job_id, data);

      if (job_id) {
        // ✅ Video hissi: kartı anında çıkar
        dispatchJobCreated(job_id, payload);

        // ✅ Paneli atmo'ya çekmek istersen
        window.RightPanel?.force?.("atmo", {});
      }

      return { ok:true, job_id, raw:data };
    } finally {
      // küçük debounce: event loop içinde ikinci tık gelmesin
      setTimeout(() => { window.__ATM_CREATE_INFLIGHT__ = false; }, 800);
    }
  };

  console.log("[ATM_CREATE] bound ✅");
})();
