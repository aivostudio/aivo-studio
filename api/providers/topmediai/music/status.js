// api/providers/topmediai/music/status.js
// GET ?ids=id1,id2  | ?provider_job_id=... | ?job_id=...
// Primary: GET https://api.topmediai.com/v3/music/tasks?ids=...
// TopMediai: status == 0 => ready (audio_url usable)

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

function normalizeState({ audioUrl, statusValue, failCode, failReason }) {
  // if audio exists => completed
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

    // Accept ids/provider_job_id/job_id
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

    const provider_song_ids = uniqStrings(raw.includes(",") ? raw.split(",") : [raw]);
    const provider_job_id = provider_song_ids[0] || raw;

    // --- V3 tasks
    let v3 = { http_status: 0, raw: null };
    try {
      const v3Res = await fetch(
        `https://api.topmediai.com/v3/music/tasks?ids=${encodeURIComponent(provider_song_ids.join(","))}`,
        {
          method: "GET",
          headers: { "accept": "application/json", "x-api-key": KEY },
        }
      );
      const v3Text = await v3Res.text();
      v3.http_status = v3Res.status;
      v3.raw = safeJsonParse(v3Text) ?? { _non_json: v3Text };
    } catch (e) {
      v3 = { http_status: 0, raw: { _fetch_error: String(e?.message || e) } };
    }

    // Expect array in: raw.data OR raw.data.data OR raw itself
    const v3Arr =
      Array.isArray(v3.raw?.data) ? v3.raw.data :
      Array.isArray(v3.raw?.data?.data) ? v3.raw.data.data :
      Array.isArray(v3.raw) ? v3.raw :
      null;

    let picked = null;
    if (Array.isArray(v3Arr) && v3Arr.length) {
      // prefer a READY item (status==0) with audio url
      picked =
        v3Arr.find((t) => Number(t?.status) === 0 && extractAudioUrl(t)) ||
        v3Arr.find((t) => extractAudioUrl(t)) ||
        v3Arr[0];
    }

    const audioUrl = extractAudioUrl(picked);
    const failCode = picked?.fail_code ?? picked?.failCode ?? null;
    const failReason = picked?.fail_reason ?? picked?.failReason ?? null;
    const statusValue = picked?.status ?? null;

    const state = normalizeState({ audioUrl, statusValue, failCode, failReason });

    // UI convenience
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
      topmediai: { v3, picked: picked || null },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
