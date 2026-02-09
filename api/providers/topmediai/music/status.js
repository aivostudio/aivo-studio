// api/providers/topmediai/music/status.js
// GET ?provider_job_id=... | ?job_id=...
// Primary:  GET https://api.topmediai.com/v3/music/tasks?ids=...
// Fallback: GET https://api.topmediai.com/v2/query?song_id=...
// Output: stable { ok, provider, job, state, status, audio?, topmediai:{...} }

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function extractAudioUrl(any) {
  if (!any) return null;
  return (
    any.audio_url || any.audioUrl ||
    any.song_url || any.songUrl ||
    any.file_url || any.fileUrl ||
    any.download_url || any.downloadUrl ||
    any.url || any.mp3 ||
    any.audio?.url || any.audio?.src ||
    null
  );
}

function normalizeState({ audioUrl, failCode, failReason, statusValue }) {
  if (audioUrl) return "COMPLETED";
  if (failReason || (typeof failCode === "number" && failCode !== 0)) return "FAILED";

  // statusValue (v3) docs: integer (tam mapping net değil) :contentReference[oaicite:1]{index=1}
  // safest: audio_url yoksa processing say
  return "PROCESSING";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const KEY = process.env.TOPMEDIAI_API_KEY;
    if (!KEY) {
      return res.status(500).json({ ok: false, error: "missing_topmediai_api_key" });
    }

    const jobId = String(req.query.provider_job_id || req.query.job_id || "").trim();
    if (!jobId) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    // --- 1) V3 tasks (en doğru: audio_url burada) :contentReference[oaicite:2]{index=2}
    let v3 = { http_status: null, raw: null };
    try {
      const v3Res = await fetch(
        `https://api.topmediai.com/v3/music/tasks?ids=${encodeURIComponent(jobId)}`,
        { method: "GET", headers: { "x-api-key": KEY } }
      );
      const v3Text = await v3Res.text();
      v3.http_status = v3Res.status;
      v3.raw = safeJsonParse(v3Text) ?? { _non_json: v3Text };
    } catch (e) {
      v3 = { http_status: 0, raw: { _fetch_error: String(e?.message || e) } };
    }

    // Expect: array of tasks :contentReference[oaicite:3]{index=3}
    const v3Arr = Array.isArray(v3.raw) ? v3.raw : null;
    const v3Task = v3Arr && v3Arr.length ? v3Arr[0] : null;

    let audioUrl = extractAudioUrl(v3Task);
    let failCode = v3Task?.fail_code ?? null;
    let failReason = v3Task?.fail_reason ?? null;
    let statusValue = v3Task?.status ?? null;

    // --- 2) Fallback: V2 query (bazı hesaplarda v3 erişimi/ids boş dönebilir) :contentReference[oaicite:4]{index=4}
    let v2 = null;
    if (!audioUrl && !failReason && !failCode && (!v3Task || !v3Arr)) {
      try {
        const v2Res = await fetch(
          `https://api.topmediai.com/v2/query?song_id=${encodeURIComponent(jobId)}`,
          { method: "GET", headers: { "x-api-key": KEY } }
        );
        const v2Text = await v2Res.text();
        const v2Json = safeJsonParse(v2Text) ?? { _non_json: v2Text };
        v2 = { http_status: v2Res.status, raw: v2Json };

        audioUrl = audioUrl || extractAudioUrl(v2Json) || extractAudioUrl(v2Json?.data) || extractAudioUrl(v2Json?.result);
        // v2'de fail alanları standard değil; burada sadece audio yakalamaya çalışıyoruz.
      } catch (e) {
        v2 = { http_status: 0, raw: { _fetch_error: String(e?.message || e) } };
      }
    }

    if (String(req.query.debug || "") === "1") {
      return res.status(200).json({
        ok: true,
        debug: true,
        provider: "topmediai",
        job_id: jobId,
        extracted: { audioUrl, failCode, failReason, statusValue },
        topmediai: { v3, v2 },
      });
    }

    // v3 endpoint hard fail olduysa ama yine de 200 dönüp UI polling sürsün:
    const state = normalizeState({ audioUrl, failCode, failReason, statusValue });
    const status = state === "COMPLETED" ? "completed" : state === "FAILED" ? "failed" : "processing";

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      provider_job_id: jobId,
      job: { job_id: jobId, status: state },
      state,
      status,
      audio: audioUrl ? { src: audioUrl } : null,
      // observability
      topmediai: {
        v3: v3.http_status ? v3 : null,
        v2,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
