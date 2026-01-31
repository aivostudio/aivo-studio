export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const job_id = body.job_id || body.jobId || null;

    console.log("[video/generate] hit", { job_id });

    return res.status(200).json({ ok: true, job_id });
  } catch (e) {
    console.error("[video/generate] error", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
