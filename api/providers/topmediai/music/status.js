// api/providers/topmediai/music/status.js
// GET ?provider_job_id=... | ?job_id=... | ?ids=id1,id2
// Primary:  GET https://api.topmediai.com/v3/music/tasks?ids=...
// Output: stable { ok, provider, provider_job_id, provider_song_ids, job, state, status, audio?, topmediai:{...} }

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const s = String(x || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
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

function normalizeStateFromV3({ audioUrl, statusValue, failCode, failReason }) {
  // TopMediai support: status==0 => ready (audio_url usable)
  if (audioUrl) return "COMPLETED";

  const stNum = typeof statusValue === "number" ? statusValue : Number(statusValue);
  const hasFail =
    Boolean(failReason) ||
    (typeof failCode === "number" && failCode !== 0) ||
    (Number.isFinite(stNum) && stNum < 0);

  if (hasFail) return "FAILED";

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

    // Accept job_id/provider_job_id/ids
    const raw = String(
      req.query.ids ||
      req.query.provider_song_ids ||
      req.query.provider_job_id ||
      req.query.job_id ||
      ""
    ).trim();

    if (!raw) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    // ids can be "id1,id2" or a single id
    const provider_song_ids = uniqStrings(
      raw.includes(",") ? raw.split(",") : [raw]
    );

    // Backward compat: provider_job_id = first id
    const provider_job_id = provider_song_ids[0] || raw;

    // --- V3 tasks
    let v3 = { http_status: 0, raw: null };
    try {
      const v3Res = await fetch(
        `https://api.topmediai.com/v3/music/tasks?ids=${encodeURIComponent(provider_song_ids.join(","))}`,
        { method: "GET", headers: { "accept": "application/json", "x-api-key": KEY } }
      );
      const v3Text = await v3Res.text();
      v3.http_status = v3Res.status;
      v3.raw = safeJsonParse(v3Text) ?? { _non_json: v3Text };
    } catch (e) {
      v3 = { http_status: 0, raw: { _fetch_error: String(e?.message || e) } };
    }

    // Expect: { data: [ ...tasks ] }
    const v3Arr =
      Array.isArray(v3.raw?.data) ? v3.raw.data :
      Array.isArray(v3.raw?.data?.data) ? v3.raw.data.data :
      Array.isArray(v3.raw) ? v3.raw : // ultra fallback (bazı env’lerde direkt array gelebilir)
      null;

    // pick the first READY task with audio_url, else first task
    let picked = null;
    if (Array.isArray(v3Arr) && v3Arr.length) {
      picked =
        v3Arr.find((t) => Number(t?.status) === 0 && extractAudioUrl(t)) ||
        v3Arr[0];
    }

    const audioUrl = extractAudioUrl(picked);
    const failCode = picked?.fail_code ?? picked?.failCode ?? null;
    const failReason = picked?.fail_reason ?? picked?.failReason ?? null;
    const statusValue = picked?.status ?? null;

    if (String(req.query.debug || "") === "1") {
      return res.status(200).json({
        ok: true,
        debug: true,
        provider: "topmediai",
        provider_job_id,
        provider_song_ids,
        extracted: { audioUrl, failCode, failReason, statusValue },
        topmediai: { v3 },
      });
    }

    const state = normalizeStateFromV3({ audioUrl, statusValue, failCode, failReason });
    const status =
      state === "COMPLETED" ? "completed" :
      state === "FAILED" ? "failed" :
      "processing";

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      provider_job_id,
      provider_song_ids,
      job: { job_id: provider_job_id, status: state },
      state,
      status,
      audio: audioUrl ? { src: audioUrl } : null,
      // observability
      topmediai: { v3 },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
