// api/providers/topmediai/music/status.js
// GET ?provider_job_id=... | ?job_id=...  (taskId)
// Opsiyonel: ?ids=id1,id2 (track ids) fallback
//
// Primary:  GET https://api.topmediai.com/v3/music/tasks?taskId=...
// Fallback: GET https://api.topmediai.com/v3/music/tasks?ids=id1,id2
//
// Output: stable { ok, provider, provider_job_id, provider_song_ids, state, status, audio? }

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

function extractAudioUrlFromTask(task) {
  if (!task) return null;

  // 1) direct
  const direct = extractAudioUrl(task);
  if (direct) return direct;

  // 2) tracks inside task
  const tracks = Array.isArray(task.tracks) ? task.tracks : [];

  const readyTrack =
    tracks.find((t) => Number(t?.status) === 0 && extractAudioUrl(t)) ||
    tracks.find((t) => extractAudioUrl(t)) ||
    null;

  return readyTrack ? extractAudioUrl(readyTrack) : null;
}

function normalizeStateFromV3({ audioUrl, statusValue, failCode, failReason }) {
  // TopMediai support: status==0 => ready
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

    // Prefer taskId
    const rawTaskId = String(req.query.provider_job_id || req.query.job_id || "").trim();
    const rawIds = String(req.query.ids || req.query.provider_song_ids || "").trim();

    if (!rawTaskId && !rawIds) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    const provider_song_ids = uniqStrings(
      rawIds
        ? (rawIds.includes(",") ? rawIds.split(",") : [rawIds])
        : []
    );

    const provider_job_id = rawTaskId || provider_song_ids[0] || "";

    // --- V3 tasks
    let v3 = { http_status: 0, raw: null };

    try {
      const qs = rawTaskId
        ? `taskId=${encodeURIComponent(rawTaskId)}`
        : `ids=${encodeURIComponent(provider_song_ids.join(","))}`;

      const v3Res = await fetch(`https://api.topmediai.com/v3/music/tasks?${qs}`, {
        method: "GET",
        headers: { accept: "application/json", "x-api-key": KEY },
      });

      const v3Text = await v3Res.text();
      v3.http_status = v3Res.status;
      v3.raw = safeJsonParse(v3Text) ?? { _non_json: v3Text };
    } catch (e) {
      v3 = { http_status: 0, raw: { _fetch_error: String(e?.message || e) } };
    }

    // normalize possible shapes
    // - { data: [ ... ] }
    // - { data: { data: [ ... ] } }
    // - { data: { task: {...} } }
    // - { data: {...task...} }
    const maybeData = v3.raw?.data;

    const v3Arr =
      Array.isArray(maybeData) ? maybeData :
      Array.isArray(maybeData?.data) ? maybeData.data :
      Array.isArray(v3.raw) ? v3.raw :
      null;

    let picked = null;

    if (Array.isArray(v3Arr) && v3Arr.length) {
      // list mode
      picked =
        v3Arr.find((t) => extractAudioUrlFromTask(t)) ||
        v3Arr[0];
    } else {
      // single task mode
      const single =
        (maybeData?.task && typeof maybeData.task === "object") ? maybeData.task :
        (maybeData && typeof maybeData === "object") ? maybeData :
        null;

      picked = single;
    }

    const audioUrl = extractAudioUrlFromTask(picked);

    const failCode =
      picked?.fail_code ?? picked?.failCode ??
      picked?.error_code ?? picked?.errorCode ??
      null;

    const failReason =
      picked?.fail_reason ?? picked?.failReason ??
      picked?.error_reason ?? picked?.errorReason ??
      picked?.message ??
      null;

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
      topmediai: { v3 }, // observability
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
