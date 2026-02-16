import { neon } from "@neondatabase/serverless";

function extractUserId(req) {
  const cookie = req.headers.cookie || "";
  const match =
    cookie.match(/aivo_session=([^;]+)/) ||
    cookie.match(/aivo_sess=([^;]+)/);
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let db_debug = { tried: false, hasConn: false, inserted: false, updated: false, error: null };

  try {
    const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;
    if (!RUNWAYML_API_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_env_RUNWAYML_API_SECRET" });
    }

    const {
      prompt,
      mode = "text",
      image_url = null,

      // ✅ FIX: Default model artık Gen-4.5
      model = "runway/gen-4.5",

      seconds: _seconds = 8,
      duration = undefined,

      aspect_ratio: _aspect_ratio = "16:9",
      ratio = undefined,

      resolution = undefined,
      audio = undefined,
    } = req.body || {};

    // ===============================
    // Duration normalize (Runway UI: 5 / 8 / 10)
    // ===============================
    let seconds =
      (typeof duration === "number" && Number.isFinite(duration) ? duration : _seconds);

    const allowedDurations = [5, 8, 10];

    // Eğer 4 gibi unsupported gelirse en yakın değere yuvarla
    if (!allowedDurations.includes(seconds)) {
      seconds = allowedDurations.reduce((prev, curr) =>
        Math.abs(curr - seconds) < Math.abs(prev - seconds) ? curr : prev
      );
    }

    const aspect_ratio =
      (typeof ratio === "string" && ratio ? ratio : _aspect_ratio);

    const resolutionNum =
      (typeof resolution === "number" && Number.isFinite(resolution) ? resolution : undefined);

    const audioBool =
      (typeof audio === "boolean" ? audio : undefined);

    if (!prompt) return res.status(400).json({ ok: false, error: "missing_prompt" });

    if (mode === "image" && !image_url) {
      return res.status(400).json({ ok: false, error: "missing_image_url" });
    }

    const ratioMap = {
      "16:9": "1280:720",
      "9:16": "720:1280",
      "4:3": "1104:832",
      "1:1": "960:960",
      "3:4": "832:1104",
    };

    const runwayPayload = {
      model,
      promptText: prompt,
      duration: seconds,
      ratio: ratioMap[aspect_ratio] || ratioMap["16:9"],
    };

    if (typeof resolutionNum === "number") runwayPayload.resolution = resolutionNum;
    if (typeof audioBool === "boolean") runwayPayload.audio = audioBool;

    const endpoint =
      mode === "image"
        ? "https://api.dev.runwayml.com/v1/image_to_video"
        : "https://api.dev.runwayml.com/v1/text_to_video";

    if (mode === "image") runwayPayload.promptImage = image_url;

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
      return res.status(500).json({
        ok: false,
        error: "missing_db_env",
        db_debug,
      });
    }

    const sql = neon(conn);

    const user_id = extractUserId(req) || "anonymous";

    // ===============================
    // 1) önce DB job aç
    // ===============================
    let job_id = crypto.randomUUID();

    try {
      db_debug.tried = true;

      await sql`
        insert into jobs (
          id,
          user_id,
          app,
          provider,
          request_id,
          status,
          prompt,
          meta,
          outputs,
          error,
          created_at,
          updated_at
        )
        values (
          ${job_id},
          ${user_id},
          ${"video"},
          ${"runway"},
          ${null},
          ${"processing"},
          ${prompt},
          ${JSON.stringify({
            mode,
            model,
            seconds, // ✅ clamp edilmiş hali DB’ye yazılıyor
            aspect_ratio,
            resolution: resolutionNum ?? null,
            audio: audioBool ?? null,
            image_url: image_url ?? null,
          })},
          ${JSON.stringify([])},
          ${null},
          now(),
          now()
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
      // Runway unreachable
      const errText = String(e?.message || e);

      await sql`
        update jobs
        set status = ${"failed"},
            error = ${errText},
            updated_at = now()
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
    // 3) Eğer response.ok değilse -> job failed
    // ===============================
    if (!r.ok) {
      const errText =
        (data && (data.error || data.message)) ||
        JSON.stringify(data) ||
        "runway_create_failed";

      try {
        await sql`
          update jobs
          set status = ${"failed"},
              error = ${errText},
              meta = meta || ${JSON.stringify({
                runway_status: r.status,
                runway_response: data,
                runway_endpoint: endpoint,
              })},
              updated_at = now()
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
    // 4) Sadece 200 ise task_id kaydet
    // ===============================
    const request_id = data?.id || data?.task_id || data?.request_id;

    if (!request_id) {
      await sql`
        update jobs
        set status = ${"failed"},
            error = ${"runway_missing_request_id"},
            meta = meta || ${JSON.stringify({
              runway_response: data,
              runway_endpoint: endpoint,
            })},
            updated_at = now()
        where id = ${job_id}
      `;

      return res.status(500).json({
        ok: false,
        error: "runway_missing_request_id",
        raw: data,
        db_debug,
      });
    }

    // DB’ye request_id yaz
    try {
      await sql`
        update jobs
        set request_id = ${String(request_id)},
            status = ${"running"},
            updated_at = now()
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
