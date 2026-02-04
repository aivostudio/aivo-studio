// studio.music.generate.js
(() => {
  const LOG = (...a) => console.log("%c[music-generate]", "color:#b58cff", ...a);

  function findBtn() {
    // 1) net id (varsa)
    const byId =
      document.getElementById("musicGenerateBtn") ||
      document.getElementById("btnMusicGenerate") ||
      document.getElementById("generateMusicBtn");

    if (byId) return byId;

    // 2) data attr (önerilen)
    const byData =
      document.querySelector('button[data-generate="music"]') ||
      document.querySelector('[data-action="music-generate"]');

    if (byData) return byData;

    // 3) metin fallback (en son çare)
    const candidates = Array.from(document.querySelectorAll("button, a, [role='button']"));
    return candidates.find(el => (el.textContent || "").toLowerCase().includes("müzik üret")) || null;
  }

  async function createJob() {
    // önce /api/music/generate dene; yoksa /api/jobs/create fallback
    const payload = { type: "music" };

    async function postJson(url) {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch {}
      return { ok: r.ok, status: r.status, data, text, url };
    }

    let res = await postJson("/api/music/generate");
    if (!res.ok) {
      LOG("primary failed:", res.url, res.status, res.data || res.text);
      res = await postJson("/api/jobs/create");
    }
    LOG("createJob response:", res.url, res.status, res.data || res.text);

    const job_id =
      res?.data?.job_id ||
      res?.data?.jobId ||
      res?.data?.id ||
      null;

    if (!job_id) throw new Error("job_id missing");
    return job_id;
  }

  function safeUpsert(job) {
    if (window.AIVO_JOBS?.upsert) {
      window.AIVO_JOBS.upsert(job);
      LOG("AIVO_JOBS.upsert OK:", job);
      return true;
    }
    LOG("AIVO_JOBS.upsert MISSING!");
    return false;
  }

  function wire() {
    const btn = findBtn();
    if (!btn) {
      LOG("❌ button not found");
      return false;
    }

    if (btn.dataset.wired === "1") {
      LOG("already wired");
      return true;
    }

    btn.dataset.wired = "1";
    LOG("✅ wired:", btn);

    btn.addEventListener("click", async (e) => {
      // bazı sayfalarda <a> veya form submit olabiliyor
      e.preventDefault?.();
      e.stopPropagation?.();

      LOG("clicked");

      try {
        const job_id = await createJob();
        LOG("job_id:", job_id);

        safeUpsert({ job_id, type: "music", created_at: Date.now() });
      } catch (err) {
        console.error("[music-generate] ❌", err);
      }
    }, { capture: true });

    return true;
  }

  // DOM hazır olmadan wire koşmasın
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire, { once: true });
  } else {
    wire();
  }

  // SPA / route değişimlerinde buton sonradan gelirse diye 1 kez daha dene
  setTimeout(() => {
    try { wire(); } catch {}
  }, 1200);
})();
