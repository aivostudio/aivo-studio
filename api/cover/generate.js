// api/cover/generate.js
import crypto from "node:crypto";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { prompt } = req.body || {};
    const p = String(prompt || "").trim();

    if (!p) {
      return res.status(400).json({ ok: false, error: "Prompt boş" });
    }

    // 1) Kullanıcıyı auth endpoint'inden al
    const proto =
      req.headers["x-forwarded-proto"] ||
      (req.headers.host || "").includes("localhost")
        ? "http"
        : "https";

    const host = req.headers.host;
    const baseUrl = `${proto}://${host}`;

    const cookie = req.headers.cookie || "";

    const meResp = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        cookie,
        accept: "application/json",
      },
    });

    const me = await meResp.json().catch(() => null);

    const userUuid =
      me?.user?.uuid ||
      me?.user_uuid ||
      me?.uuid ||
      "";

    const email =
      me?.user?.email ||
      me?.email ||
      "";

    if (!userUuid) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // 2) Job oluştur
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 3) Şimdilik mock görsel
    const seed = encodeURIComponent(p.slice(0, 120));
    const imageUrl = `https://picsum.photos/seed/${seed}/768/768`;

    // 4) DB'ye job yaz
    // NOT:
    // Projendeki DB helper farklı olabilir.
    // Bu yüzden önce global/store/supabase varsa onları dener.
    const db =
      globalThis.supabaseAdmin ||
      globalThis.supabase ||
      globalThis.db ||
      null;

    if (!db) {
      return res.status(500).json({
        ok: false,
        error: "DB bağlantısı bulunamadı (supabase/db helper yok)",
      });
    }

    const row = {
      job_id: jobId,
      user_uuid: userUuid,
      app: "cover",
      provider: "mock",
      db_status: "ready",
      status: "completed",
      created_at: now,
      updated_at: now,
      meta: {
        app: "cover",
        prompt: p,
        email,
        mock: true,
      },
      outputs: [
        {
          type: "image",
          url: imageUrl,
          meta: {
            app: "cover",
            kind: "image",
          },
        },
      ],
    };

    // Supabase benzeri insert
    if (typeof db.from === "function") {
      const { error } = await db.from("jobs").insert(row);
      if (error) {
        return res.status(500).json({
          ok: false,
          error: error.message || "jobs insert failed",
        });
      }
    } else if (typeof db.insertJob === "function") {
      await db.insertJob(row);
    } else {
      return res.status(500).json({
        ok: false,
        error: "Desteklenen DB insert helper bulunamadı",
      });
    }

    return res.status(200).json({
      ok: true,
      app: "cover",
      job_id: jobId,
      db_status: "ready",
      type: "cover",
      imageUrl,
      prompt: p,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Server error",
    });
  }
}
