// api/jobs/status.js
// CommonJS

const { neon } = require("@neondatabase/serverless");
const { getRedis } = require("../_kv");

function pickUrl(x) {
  if (!x) return null;
  return (
    x.src ||
    x.url ||
    x.play_url ||
    x.output_url ||
    x.download_url ||
    x.signed_url ||
    null
  );
}

function isUuidLike(id) {
  return /^[0-9a-f-]{36}$/i.test(String(id || ""));
}

async function fetchRunwayTask(taskId) {
  const key = process.env.RUNWAYML_API_SECRET;
  if (!key) return { ok: false };

  const r = await fetch(
    `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Runway-Version": "2024-11-06",
      },
    }
  );

  if (!r.ok) return { ok: false };
  const j = await r.json().catch(() => null);
  return { ok: true, task: j };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false });
    }

    res.setHeader("Cache-Control", "no-store");

    const job_id = String(req.query.job_id || "").trim();
    if (!job_id) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    // --- DB bağlantı ---
    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    const sql = neon(conn);

    // --- DB’den job çek ---
    const rows = await sql`
      select * from jobs
      where id = ${job_id}
      limit 1
    `;

    let job = rows[0] || null;

    if (!job) {
      return res.status(404).json({ ok: false, error: "job_not_found" });
    }

    // --- Runway ise poll et ---
    const provider = String(job.provider || "").toLowerCase();
    const requestId = job.request_id || job.meta?.request_id || null;

    let videoUrl = null;

    if (provider === "runway" && requestId && isUuidLike(requestId)) {
      const rr = await fetchRunwayTask(requestId);

      if (rr.ok) {
        const st = String(rr.task?.status || "").toUpperCase();

        const outArr = Array.isArray(rr.task?.output)
          ? rr.task.output
          : [];

        const rawUrl =
          outArr.find(
            (x) => typeof x === "string" && x.startsWith("http")
          ) || null;

        if ((st === "SUCCEEDED" || st === "COMPLETED") && rawUrl) {
          videoUrl = rawUrl;

          const outputs = [
            { type: "video", url: rawUrl, meta: { app: "video" } },
          ];

          // 🔥 BURASI KRİTİK — DB UPDATE
          await sql`
            update jobs
            set status = 'completed',
                outputs = ${JSON.stringify(outputs)}::jsonb,
                updated_at = now()
            where id = ${job_id}
          `;

          job.status = "completed";
          job.outputs = outputs;
        }
      }
    }

    // Proxy uygula
    const finalVideo =
      videoUrl && /^https?:\/\//i.test(videoUrl)
        ? "/api/media/proxy?url=" + encodeURIComponent(videoUrl)
        : null;

    return res.status(200).json({
      ok: true,
      job_id,
      status:
        job.status === "completed"
          ? "ready"
          : job.status === "failed"
          ? "error"
          : "processing",
      video: finalVideo ? { url: finalVideo } : null,
      outputs: job.outputs || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
