// api/cover/generate.js
import { getUserFromReq } from "../_lib/auth.js";
import { query } from "../_lib/r2.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const user = await getUserFromReq(req);
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const {
      prompt = "",
      style = null,
      quality = "artist",
      ratio = "1:1",
      imageUrl = "",
    } = req.body || {};

    const p = String(prompt || "").trim();
    const finalImageUrl = String(imageUrl || "").trim();

    if (!p) {
      return res.status(400).json({ ok: false, error: "Prompt boş" });
    }

    if (!finalImageUrl) {
      const seed = encodeURIComponent(p.slice(0, 120));
      const fallbackUrl = `https://picsum.photos/seed/${seed}/768/768`;

      return res.status(200).json({
        ok: true,
        type: "cover",
        imageUrl: fallbackUrl,
        prompt: p,
        job_id: null,
        mock: true,
      });
    }

    const inserted = await query(
      `
      INSERT INTO jobs (
        user_id,
        app,
        status,
        prompt,
        meta,
        outputs,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        user.id,
        "cover",
        "ready",
        p,
        JSON.stringify({
          app: "cover",
          prompt: p,
          style,
          quality,
          ratio,
        }),
        JSON.stringify([
          {
            type: "image",
            url: finalImageUrl,
            meta: {
              app: "cover",
              prompt: p,
              style,
              quality,
              ratio,
            },
          },
        ]),
      ]
    );

    const jobId =
      inserted?.insertId ||
      inserted?.rows?.insertId ||
      inserted?.[0]?.insertId ||
      null;

    return res.status(200).json({
      ok: true,
      type: "cover",
      job_id: jobId,
      imageUrl: finalImageUrl,
      prompt: p,
    });
  } catch (e) {
    console.error("[api/cover/generate] error", e);
    return res.status(500).json({
      ok: false,
      error: e?.message || "Server error",
    });
  }
}
