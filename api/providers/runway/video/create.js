import { neon } from "@neondatabase/serverless";

function extractUserId(req) {
  const cookie = req.headers.cookie || "";
  const match =
    cookie.match(/aivo_session=([^;]+)/) ||
    cookie.match(/aivo_sess=([^;]+)/);
  return match ? match[1] : null;
}

// Gen-4.5 duration seçenekleri (Runway UI: 5/8/10)
function normalizeDuration(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return 8;

  // desteklenen: 5, 8, 10
  if (n <= 5) return 5;
  if (n <= 8) return 8;
  return 10;
}

function normalizeRatio(aspect_ratio) {
  const ratioMap = {
    "16:9": "1280:720",
    "9:16": "720:1280",
    "4:3": "1104:832",
    "1:1": "960:960",
    "3:4": "832:1104",
  };
  return ratioMap[aspect_ratio] || ratioMap["16:9"];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let db_debug = {
    tried: false,
    hasConn: false,
    inserted: false,
    updated: false,
    error: null,
  };

  try {
    const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;
    if (!RUNWAYML_API_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_env_RUNWAYML_API_SECRET" });
    }

    const {
      prompt,
      mode = "text",            // "text" | "image"
      image_url = null,

    // ✅ Runway docs: Gen-4.5 model id = "gen4.5"
const {
  prompt,
  mode = "text",
  image_url = null,
  model = "gen4.5",

  seconds: _seconds = 8,
  duration = undefined,

  aspect_ratio: _aspect_ratio = "16:9",
  ratio = undefined,

  // UI gönderirse parse et ama Gen-4.5 payload'a EKLEME
  resolution = undefined,
  audio = undefined,
} = req.body || {};

// -------------------------------
// Validation
// -------------------------------
if (!prompt && mode !== "image") {
  return res.status(400).json({ ok: false, error: "missing_prompt" });
}
if (mode === "image" && !image_url) {
  return res.status(400).json({ ok: false, error: "missing_image_url" });
}

// -------------------------------
// Normalize inputs
// -------------------------------
const secondsRaw =
  (typeof duration === "number" && Number.isFinite(duration)) ? duration : _seconds;

const aspect_ratio =
  (typeof ratio === "string" && ratio) ? ratio : _aspect_ratio;

const seconds = normalizeDuration(secondsRaw);     // 5/8/10 clamp
const runwayRatio = normalizeRatio(aspect_ratio);  // "1280:720" vs

// (Gen-4.5 için kullanılmayacak ama debug için saklayabilirsin)
const resolutionNum =
  (typeof resolution === "number" && Number.isFinite(resolution)) ? resolution : undefined;

const audioBool =
  (typeof audio === "boolean") ? audio : undefined;

// -------------------------------
// Build Runway payload (Gen-4.5)
// ❗️resolution/audio burada YOK
// -------------------------------
const runwayPayload = {
  model,               // "gen4.5"
  promptText: prompt || "",
  duration: seconds,   // 5/8/10
  ratio: runwayRatio,  // "1280:720" etc
};

if (mode === "image") {
  runwayPayload.promptImage = image_url; // ✅ image_to_video için zorunlu
}

   // ✅ Gen-4.5: mode'a göre doğru endpoint
const endpoint =
  mode === "image"
    ? "https://api.dev.runwayml.com/v1/image_to_video"
    : "https://api.dev.runwayml.com/v1/text_to_video";


    const runwayPayload = {
      model,                 // "gen4.5"
      promptText: prompt || "",
      duration: seconds,     // 5/8/10
      ratio: runwayRatio,
    };

    if (mode === "image") runwayPayload.promptImage = image_url;

    if (typeof resolutionNum === "number") runwayPayload.resolution = resolutionNum;
    if (typeof audioBool === "boolean") runwayPayload.audio = audioBool;

    // ===============================
    // DB Connect
    // ===============================
    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    db_debug.hasConn = !!conn;

    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env", db_debug });
    }

    const sql = neon(conn);
    const user_id = extractUserId(req) || "anonymous";
    const job_id = crypto.randomUUID();

    // ===============================
    // 1) önce DB job aç (✅ enum uyumlu)
    // ===============================
    try {
      db_debug.tried = true;

      await sql`
        insert into jobs (
          id,
          user_id,
          type,
          status,
          created_at,
          app,
          meta,
          outputs,
          error,
          updated_at,
          request_id,
          prompt,
          provider
        )
        values (
          ${job_id},
          ${user_id},
          ${"video"},
          ${"queued"},
          now(),
          ${"video"},
          ${JSON.stringify({
            mode,
            model,
            seconds,
            aspect_ratio,
            resolution: resolutionNum ?? null,
            audio: audioBool ?? null,
            image_url: image_url ?? null,
            runway: {
              endpoint,
              payload: runwayPayload,
            },
          })}::jsonb,
          ${JSON.stringify([])}::jsonb,
          ${null},
          now()::timestamp,
          ${null},
          ${prompt || ""},
          ${"runway"}
        )
      `;

      db_debug.inserted = true;
    } catch (e) {
      db_debug.error = String(e?.message || e);
      console.error("DB insert failed:", e);

      return res.status(500).json({
        ok: false,
        error: "db_insert_failed",
        message: db_debug.error,
        db_debug,
      });
    }

    // ===============================
    // 2) Runway create
    // ===============================
    let r, data;

    try {
      // queued -> processing
      await sql`
        update jobs
        set status = ${"processing"},
            updated_at = now()::timestamp
        where id = ${job_id}
      `;

      r = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RUNWAYML_API_SECRET}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06",
        },
        body: JSON.stringify(runwayPayload),
      });

      data = await r.json().catch(() => ({}));
    } catch (e) {
      const errText = String(e?.message || e);

      await sql`
        update jobs
        set status = ${"error"},
            error = ${errText},
            updated_at = now()::timestamp
        where id = ${job_id}
      `;

      return res.status(500).json({
        ok: false,
        error: "runway_network_error",
        message: errText,
        db_debug,
      });
    }

    // ===============================
    // 3) Runway error -> DB error
    // ===============================
    if (!r.ok) {
      const errText =
        (data && (data.error || data.message)) ||
        JSON.stringify(data) ||
        "runway_create_failed";

      try {
        await sql`
          update jobs
          set status = ${"error"},
              error = ${errText},
              meta = (coalesce(meta, '{}'::jsonb) || ${JSON.stringify({
                runway_status: r.status,
                runway_response: data,
                runway_endpoint: endpoint,
              })}::jsonb),
              updated_at = now()::timestamp
          where id = ${job_id}
        `;

        db_debug.updated = true;
      } catch (e) {
        console.error("DB update failed:", e);
      }

      return res.status(r.status).json({
        ok: false,
        error: "runway_create_failed",
        details: data,
        sent: runwayPayload,
        endpoint,
        db_debug,
      });
    }

    // ===============================
    // 4) Task id kaydet
    // ===============================
    const request_id = data?.id || data?.task_id || data?.request_id;

    if (!request_id) {
      await sql`
        update jobs
        set status = ${"error"},
            error = ${"runway_missing_request_id"},
            meta = (coalesce(meta, '{}'::jsonb) || ${JSON.stringify({
              runway_response: data,
              runway_endpoint: endpoint,
            })}::jsonb),
            updated_at = now()::timestamp
        where id = ${job_id}
      `;

      return res.status(500).json({
        ok: false,
        error: "runway_missing_request_id",
        raw: data,
        db_debug,
      });
    }

    try {
      await sql`
        update jobs
        set request_id = ${String(request_id)},
            status = ${"processing"},
            updated_at = now()::timestamp
        where id = ${job_id}
      `;
      db_debug.updated = true;
    } catch (e) {
      console.error("DB update request_id failed:", e);
    }

    return res.status(200).json({
      ok: true,
      job_id,
      request_id,
      status: "IN_QUEUE",
      outputs: [],
      raw: data,
      db_debug,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
      db_debug,
    });
  }
}
