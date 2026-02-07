// api/music/status.js
// Vercel route: Worker'a proxy (R2 mapping + outputs logic Worker'da)
// ENV (opsiyonel): ARCHIVE_WORKER_ORIGIN=https://aivo-archive-worker.aivostudioapp.workers.dev

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // UI farklı isimlerle gönderebiliyor; hepsini kabul edelim
    const provider_job_id = String(
      req.query.provider_job_id ||
      req.query.providerJobId ||
      req.query.job_id ||
      ""
    ).trim();

    if (!provider_job_id) {
      return res.status(400).json({ ok: false, error: "missing_provider_job_id" });
    }

    // ⚠️ aivo.tr üstünden çağırırsan loop risk var (Cloudflare route varsa).
    // O yüzden workers.dev origin kullanıyoruz.
    const workerOrigin =
      process.env.ARCHIVE_WORKER_ORIGIN ||
      "https://aivo-archive-worker.aivostudioapp.workers.dev";

    const url =
      `${workerOrigin}/api/music/status?provider_job_id=` +
      encodeURIComponent(provider_job_id);

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
      },
    });

    const text = await r.text();
    const data = safeJsonParse(text);

    // Worker JSON dönmezse bile en azından debug verelim
    if (!data) {
      return res.status(200).json({
        ok: false,
        error: "worker_non_json",
        worker_status: r.status,
        sample: text.slice(0, 400),
      });
    }

    // =========================================================
    // ✅ TEMP FORCE READY (TEST MP3)
    // Worker şu an queued dönüyor ama R2 altyapı hazır olduğu için
    // UI'nin player'ı çalıştırabilmesi için ready + audio.src üretelim.
    //
    // Bu blok daha sonra worker gerçek ready döndürmeye başlayınca kaldırılabilir.
    // =========================================================
    if (data && data.ok === true) {
      const st = String(data.state || data.status || "").toLowerCase();

      if (st === "queued" || st === "processing" || st === "pending") {
        data.state = "ready";
        data.status = "ready";

        // output_id yoksa test output id ver
        const outId =
          data.output_id ||
          data?.audio?.output_id ||
          "test";

        data.output_id = outId;

        // provider_job_id "xxx::rev1" ise base id ile worker play'e git
        const baseId = provider_job_id.split("::")[0];

        data.audio = data.audio || {};
        data.audio.output_id = data.audio.output_id || outId;

        // audio.src yoksa /files/play üret
        data.audio.src =
          data.audio.src ||
          `/files/play?job_id=${encodeURIComponent(baseId)}&output_id=${encodeURIComponent(outId)}`;
      }
    }

    // Worker status kodunu aynen geçirmek yerine 200 dönmek UI spamini azaltır
    return res.status(200).json(data);

  } catch (err) {
    console.error("api/music/status proxy error:", err);

    // 500 yerine 200 processing: UI polling spamini keser
    return res.status(200).json({
      ok: true,
      state: "processing",
      status: "processing"
    });
  }
};
