export const config = { runtime: "nodejs" };

function pickVideoUrl(data) {
  return (
    data?.video_url ||
    data?.videoUrl ||
    data?.url ||
    data?.data?.video_url ||
    data?.data?.videoUrl ||
    data?.data?.url ||
    data?.data?.output?.video_url ||
    data?.data?.output?.url ||
    null
  );
}

function pickThumbnailUrl(data) {
  return (
    data?.thumbnail_url ||
    data?.thumbnailUrl ||
    data?.data?.thumbnail_url ||
    data?.data?.thumbnailUrl ||
    null
  );
}

function normalizeStatus(raw) {
  const status = String(raw || "").toLowerCase();

  if (status === "completed" || status === "done" || status === "success") {
    return "done";
  }

  if (status === "failed" || status === "error" || status === "canceled" || status === "cancelled") {
    return "error";
  }

  if (status === "pending" || status === "processing" || status === "generating" || status === "queued") {
    return "processing";
  }

  return "processing";
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed",
      });
    }

    const apiKey = String(process.env.HEYGEN_API_KEY || "").trim();

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "missing_heygen_api_key",
        message: "HEYGEN_API_KEY env bulunamadı.",
      });
    }

    const lipsyncId = String(
      req.query.lipsync_id ||
      req.query.lipsyncId ||
      req.query.video_id ||
      req.query.videoId ||
      ""
    ).trim();

    if (!lipsyncId) {
      return res.status(400).json({
        ok: false,
        error: "lipsync_id_required",
      });
    }

    const heygenRes = await fetch(
      `https://api.heygen.com/v3/lipsyncs/${encodeURIComponent(lipsyncId)}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          accept: "application/json",
        },
      }
    );

    const text = await heygenRes.text().catch(() => "");
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!heygenRes.ok) {
      return res.status(heygenRes.status).json({
        ok: false,
        error: "heygen_status_failed",
        provider_status: heygenRes.status,
        payload,
      });
    }

    const rawStatus =
      payload?.data?.status ||
      payload?.status ||
      payload?.data?.state ||
      payload?.state ||
      null;

    const status = normalizeStatus(rawStatus);
    const videoUrl = pickVideoUrl(payload);
    const thumbnailUrl = pickThumbnailUrl(payload);

    return res.status(200).json({
      ok: true,
      app: "lipsync",
      provider: "heygen",
      lipsync_id: lipsyncId,
      video_id: lipsyncId,
      status,
      raw_status: rawStatus,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      output: videoUrl
        ? {
            type: "video",
            url: videoUrl,
            thumbnail_url: thumbnailUrl,
            meta: {
              app: "lipsync",
              provider: "heygen",
              lipsync_id: lipsyncId,
            },
          }
        : null,
      payload,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "lipsync_status_error",
      detail: err && err.message ? String(err.message) : String(err),
    });
  }
}
