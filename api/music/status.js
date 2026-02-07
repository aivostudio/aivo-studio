// api/music/status.js
// Vercel route: Worker'a proxy (R2 mapping + outputs logic Worker'da)
// ENV (opsiyonel): ARCHIVE_WORKER_ORIGIN=https://aivo-archive-worker.aivostudioapp.workers.dev

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  // ✅ header burada olmalı
  res.setHeader("x-aivo-status-build", "status-proxy-v2-2026-02-07");

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const provider_job_id = String(
      req.query.provider_job_id ||
      req.query.providerJobId ||
      req.query.job_id ||
      ""
    ).trim();

    if (!provider_job_id) {
      return res.status(400).json({ ok: false, error: "missing_provider_job_id" });
    }

    const workerOrigin =
      process.env.ARCHIVE_WORKER_ORIGIN ||
      "https://aivo-archive-worker.aivostudioapp.workers.dev";

    const url = `${workerOrigin}/api/music/status?provider_job_id=` +
      encodeURIComponent(provider_job_id);

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
      },
    });

    const text = await r.text();
    let data = safeJsonParse(text);

    if (!data) {
      return res.status(200).json({
        ok: false,
        error: "worker_non_json",
        worker_status: r.status,
        sample: text.slice(0, 400),
      });
    }

    if (data && data.ok === true) {
      const st = String(data.state || data.status || "").toLowerCase();

      if (st === "queued" || st === "processing" || st === "pending") {
        data.state = "ready";
        data.status = "ready";

        data.is_ready = true;
        data.progress = 100;
        data.completed = true;

        const outId =
          data.output_id ||
          data?.audio?.output_id ||
          null;

        if (!outId) {
          data.state = "processing";
          data.status = "processing";
          data.audio = data.audio || {};
          data.audio.src = "";
          data.audio.error = "missing_output_id";
          return res.status(200).json(data);
        }

        data.output_id = outId;

        const baseId = provider_job_id.split("::")[0];

        data.audio = data.audio || {};
        data.audio.output_id = data.audio.output_id || outId;

        const internalJobId =
          data.internal_job_id ||
          data.internalJobId ||
          data.job_id_internal ||
          data.internal_id ||
          data.job_internal ||
          null;

        data.provider_job_id = baseId;
        data.internal_job_id = internalJobId;

        if (internalJobId) {
          data.audio.src =
            data.audio.src ||
            `/files/play?job_id=${encodeURIComponent(internalJobId)}&output_id=${encodeURIComponent(outId)}`;
        } else {
          data.audio.src = data.audio.src || "";
          data.audio.error = "missing_internal_job_id_for_play";
        }
      }
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error("api/music/status proxy error:", err);

    return res.status(200).json({
      ok: true,
      state: "processing",
      status: "processing"
    });
  }
};
