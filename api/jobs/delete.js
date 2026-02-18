// /api/jobs/delete.js
export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import authModule from "../_lib/auth.js";
const { requireAuth } = authModule;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const conn =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED;

  if (!conn) return res.status(500).json({ ok: false, error: "missing_db_env" });

  // --- auth ---
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    return res.status(401).json({ ok: false, error: "unauthorized", message: String(e?.message || e) });
  }

  const email = auth?.email ? String(auth.email) : null;
  if (!email) return res.status(401).json({ ok: false, error: "unauthorized", message: "missing_email" });

  const body = req.body || {};
  const job_id = String(body.job_id || "").trim();
  if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });

  const sql = neon(conn);

  try {
    // job’u önce bul (owner kontrolü için)
    const rows = await sql`
      select id, user_id, user_uuid
      from jobs
      where id = ${job_id}::uuid
      limit 1
    `;

    if (!rows.length) return res.status(404).json({ ok: false, error: "job_not_found" });

    const row = rows[0];
    const ownerEmail = row.user_id ? String(row.user_id) : "";
    const ownerUuid = row.user_uuid ? String(row.user_uuid) : "";

    const requesterIsOwner =
      (ownerEmail && ownerEmail === email);

    // bazı eski/yanlış import’larda user_uuid yok veya user_id yok olabiliyor.
    // admin override: orphan/test temizliği için.
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
    const requesterIsAdmin = adminEmail && adminEmail === email;

    if (!requesterIsOwner && !requesterIsAdmin) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    // HARD DELETE (en net çözüm)
    // Soft delete istersen: jobs tablosuna deleted_at ekleyip update yaparız.
    const del = await sql`
      delete from jobs
      where id = ${job_id}::uuid
      returning id
    `;

    return res.status(200).json({ ok: true, deleted: true, job_id: String(del?.[0]?.id || job_id) });
  } catch (e) {
    console.error("jobs/delete failed:", e);
    return res.status(500).json({ ok: false, error: "server_error", message: String(e?.message || e) });
  }
}
