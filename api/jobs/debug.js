export default async function handler(req, res) {
  try {
    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    // 1) Neon serverless driver varsa onu kullan
    try {
      const mod = await import("@neondatabase/serverless");
      const sql = mod.neon(conn);
      const rows = await sql`
        select id, request_id, app, status, created_at
        from jobs
        order by created_at desc
        limit 5
      `;
      return res.status(200).json({ ok: true, driver: "neon", rows });
    } catch (e) {
      // 2) Driver yoksa en azından hatayı JSON dön (patlamasın)
      return res.status(500).json({
        ok: false,
        error: "neon_driver_failed",
        message: String(e?.message || e),
      });
    }
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "debug_failed",
      message: String(e?.message || e),
    });
  }
}
