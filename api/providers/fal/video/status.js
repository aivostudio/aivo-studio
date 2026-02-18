// ===============================================
// /api/providers/fal/video/status.js  (FIXED)
// ===============================================
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

    // Default: Kling v3 PRO Text-to-Video
    // Not: İstersen query ile override edebilirsin: ?endpoint=fal-ai/kling-video/v3/pro/text-to-video
    const endpoint =
      (req.query?.endpoint || "fal-ai/kling-video/v3/pro/text-to-video")
        .toString()
        .replace(/^\/+/, ""); // güvenlik

    const base = `https://queue.fal.run/${endpoint}`;

    // ✅ Doğru queue status URL (model bazlı)
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
        fal_response: statusData,
      });
    }

    const status =
      statusData?.status ||
      statusData?.data?.status ||
      statusData?.request?.status ||
      null;

    // Completed olunca result'ı çek
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

      // Fal result şeması genelde: { data: { video: { url } } } veya { video: { url } } varyasyonları
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

// ===============================================
// CONSOLE TEST (create -> poll status)
// Not: Create tarafı 403 "Exhausted balance" ise request_id gelmez.
// ===============================================
//
// fetch("/api/providers/fal/video/create?app=atmo", {
//   method: "POST",
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify({
//     prompt: "Snow falling outside a cozy old cafe at night, warm neon lights inside, cinematic.",
//     duration: 8,
//     aspect_ratio: "9:16",
//   }),
// })
//   .then((r) => r.json())
//   .then((j) => {
//     console.log("CREATE:", j);
//     const rid = j.request_id;
//     if (!rid) throw new Error("missing request_id from create (check fal balance / 403)");

//     const tick = async () => {
//       const s = await fetch(
//         `/api/providers/fal/video/status?app=atmo&request_id=${encodeURIComponent(rid)}`
//       ).then((r) => r.json());

//       console.log("STATUS:", s.status, s.video_url || "");

//       if (s.status === "COMPLETED") return console.log("DONE URL:", s.video_url);
//       if (s.status === "FAILED" || s.status === "CANCELLED") return console.log("FAILED:", s);

//       setTimeout(tick, 5000);
//     };

//     tick();
//   })
//   .catch((e) => console.error("TEST ERROR:", e));
