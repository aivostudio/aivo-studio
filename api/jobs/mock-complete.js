// api/jobs/mock-complete.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    const redis = getRedis();

    const { job_id } = req.body || {};
    const jid = String(job_id || "").trim();
    if (!jid) return res.status(400).json({ ok: false, error: "job_id_required" });

    const raw = await redis.get(`job:${jid}`);
    if (!raw) return res.status(404).json({ ok: false, error: "job_not_found" });

    const job = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);

    job.status = "done";
    job.updated_at = now;
    job.result = job.type === "hook"
      ? { hook_url: "/assets/demo/hook.mp3", duration_sec: 3 }
      : {
          hook_url: "/assets/demo/hook.mp3",
          loop_url: "/assets/demo/loop.mp3",
          cover_url: "/assets/demo/cover.png",
          video_url: "/assets/demo/video.mp4",
          caption: "Yeni vibe. Yeni içerik.",
          hashtags: ["#aivo", "#reels", "#shorts"]
        };

    await redis.set(`job:${jid}`, JSON.stringify(job));
    return res.status(200).json({ ok: true, job });
  } catch (err) {
    console.error("jobs/mock-complete error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
