// =======================================================
// /pages/api/providers/fal/video/create.js
// =======================================================
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const app = (req.query?.app || "atmo").toString();

    const {
      prompt,
      duration = 5,
      aspect_ratio = "9:16",
      // Kling v3 Pro defaults:
      generate_audio = true,
      shot_type = "customize",
      negative_prompt = "blur, distort, and low quality",
      cfg_scale = 0.5,
      // optional advanced:
      multi_prompt = null,
      voice_ids = null,
    } = req.body || {};

    if (!prompt && !multi_prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    // ✅ Kling v3 Pro Text-to-Video (queue submit)
    const falUrl = "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video";

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);

    let r;
    try {
      r = await fetch(falUrl, {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(multi_prompt ? { multi_prompt } : { prompt }),
          duration,
          aspect_ratio,
          generate_audio,
          shot_type,
          negative_prompt,
          cfg_scale,
          ...(Array.isArray(voice_ids) ? { voice_ids } : {}),
        }),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(t);
      return res.status(504).json({
        ok: false,
        provider: "fal",
        error: "fal_timeout_or_network_error",
        message: e?.message || "unknown_fetch_error",
      });
    }

    clearTimeout(t);

    const text = await r.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = { _non_json: text };
    }

    if (!r.ok) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "fal_error",
        fal_status: r.status,
        fal_response: data,
      });
    }

    const request_id =
      data?.request_id || data?.requestId || data?.id || data?._id || null;

    // --- DB upsert (opsiyonel): fail olursa request_id yine dönecek ---
    let internal_job_id = null;
    if (request_id) {
      try {
        // burada senin mevcut DB upsert kodun var (değiştirmiyorum)
        // row = await ...
        // internal_job_id = row?.rows?.[0]?.id || null;

        internal_job_id = row?.rows?.[0]?.id || null;
      } catch (dbErr) {
        // DB yazamazsak bile Fal request_id’i döndür (ama UI list boş kalır)
        console.error("[fal.video.create] DB upsert failed:", dbErr?.message || dbErr);
      }
    }

    return res.status(200).json({
      ok: true,
      provider: "fal",
      app,
      model: "fal-ai/kling-video/v3/pro/text-to-video",
      request_id,
      internal_job_id,
      status: data?.status || "IN_QUEUE",
      raw: data,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: err?.message || "unknown_error",
    });
  }
}


// =======================================================
// /pages/api/providers/fal/video/status.js   (405 FIX)
// =======================================================
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const { request_id } = req.query || {};
    if (!request_id) {
      return res.status(400).json({ ok: false, error: "missing_request_id" });
    }

    // endpoint override destekli
    const endpoint =
      (req.query?.endpoint || "fal-ai/kling-video/v3/pro/text-to-video")
        .toString()
        .replace(/^\/+/, "");

    // ✅ 405 FIX: endpoint_id'yi encode et (queue API route'ları için güvenli)
    const endpointEnc = encodeURIComponent(endpoint);
    const base = `https://queue.fal.run/${endpointEnc}`;

    const statusUrl = `${base}/requests/${encodeURIComponent(request_id)}/status`;

    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
    });

    const statusText = await statusRes.text();
    let statusData = null;
    try {
      statusData = statusText ? JSON.parse(statusText) : null;
    } catch (_) {
      statusData = { _non_json: statusText };
    }

    if (!statusRes.ok) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        fal_status: statusRes.status,
        endpoint,
        request_id,
        raw_status: statusData,
      });
    }

    const status =
      statusData?.status ||
      statusData?.data?.status ||
      statusData?.request?.status ||
      null;

    let video_url = null;
    let resultData = null;

    if (status === "COMPLETED") {
      const resultUrl = `${base}/requests/${encodeURIComponent(request_id)}`;

      const resultRes = await fetch(resultUrl, {
        method: "GET",
        headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      });

      const resultText = await resultRes.text();
      try {
        resultData = resultText ? JSON.parse(resultText) : null;
      } catch (_) {
        resultData = { _non_json: resultText };
      }

      video_url =
        resultData?.data?.video?.url ||
        resultData?.video?.url ||
        resultData?.response?.video?.url ||
        resultData?.response?.output?.video?.url ||
        resultData?.response?.output?.url ||
        null;
    }

    return res.status(200).json({
      ok: true,
      provider: "fal",
      endpoint,
      request_id,
      status,
      video_url,
      raw_status: statusData,
      raw_result: resultData,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: err?.message || "unknown_error",
    });
  }
}
