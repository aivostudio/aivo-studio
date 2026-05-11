// /api/music/stems.js
const { neon } = require("@neondatabase/serverless");

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

async function patchJobStems(jobId, stemsPatch) {
  const id = String(jobId || "").trim();
  const conn = pickConn();

  if (!id || !isUuidLike(id) || !conn) return;

  try {
    const sql = neon(conn);

    await sql`
      update jobs
      set
        meta = coalesce(meta, '{}'::jsonb) || ${{
          stems: stemsPatch,
        }}::jsonb,
        updated_at = now()
      where id = ${id}::uuid
        and app = ${"music"}
        and deleted_at is null
    `;
  } catch (err) {
    console.warn("[api/music/stems] db patch failed:", err?.message || err);
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({ ok: false, error: "missing_REPLICATE_API_TOKEN" });
    }

    const body = req.body || {};
    const predictionId = String(body.prediction_id || body.id || "").trim();
    const audioUrl = String(body.audio_url || body.audio || "").trim();
    const jobId = String(body.job_id || body.db_job_id || "").trim();

    // =========================
    // (B) STATUS / POLL
    // =========================
    if (predictionId) {
      const r = await fetch(
        `https://api.replicate.com/v1/predictions/${encodeURIComponent(predictionId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const j = await r.json().catch(() => null);

      if (!r.ok) {
        return res.status(r.status).json({
          ok: false,
          error: "replicate_status_failed",
          status: r.status,
          detail: j,
        });
      }

      const statusValue = String(j?.status || "").toLowerCase();

      if (jobId) {
        await patchJobStems(jobId, {
          status: statusValue || null,
          prediction_id: j?.id || predictionId || null,
          output: j?.output || null,
          error: j?.error || null,
          updated_at: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        ok: true,
        mode: "status",
        id: j?.id || null,
        status: j?.status || null,
        output: j?.output || null,
        error: j?.error || null,
      });
    }

    // =========================
    // (A) CREATE
    // =========================
    if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) {
      return res.status(400).json({
        ok: false,
        error: "missing_or_invalid_audio_url",
      });
    }

    const DEMUCS_VERSION =
      "25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953";

    const payload = {
      version: DEMUCS_VERSION,
      input: {
        audio: audioUrl,
        model_name: "htdemucs_6s",
        output_format: "mp3",
        mp3_bitrate: 320,
        overlap: 0.25,
        shifts: 1,
        clip_mode: "rescale",
      },
    };

    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: "replicate_create_failed",
        status: r.status,
        detail: j,
      });
    }

    if (jobId) {
      await patchJobStems(jobId, {
        status: String(j?.status || "starting").toLowerCase(),
        prediction_id: j?.id || null,
        output: null,
        error: null,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      ok: true,
      mode: "create",
      id: j?.id || null,
      status: j?.status || null,
      urls: j?.urls || null,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: err?.message || String(err),
    });
  }
};
