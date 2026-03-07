// api/cover/generate.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { prompt } = req.body || {};
    const p = (prompt || "").trim();

    if (!p) {
      return res.status(400).json({ ok: false, error: "Prompt boş" });
    }

    // Şimdilik MOCK görsel: prompt seed'li placeholder
    const seed = encodeURIComponent(p.slice(0, 120));
    const imageUrl = `https://picsum.photos/seed/${seed}/768/768`;

    // Tek job id
    const jobId = crypto.randomUUID();

    // Neon DB job insert
    await fetch(`${req.headers.origin}/api/jobs/create`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        app: "cover",
        job_id: jobId,
        status: "completed",
        outputs: [
          {
            type: "image",
            url: imageUrl,
            meta: { app: "cover" }
          }
        ],
        meta: { prompt: p }
      })
    });

    return res.status(200).json({
      ok: true,
      type: "cover",
      job_id: jobId,
      imageUrl,
      prompt: p,
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Server error"
    });
  }
}
