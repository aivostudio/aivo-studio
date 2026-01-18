// /api/auth/logout.js
export default async function handler(req, res) {
  try {
    // Safari + Vercel uyumlu kesin cookie expire
    const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
    const base = `Path=/; Max-Age=0; Expires=${expires}; SameSite=Lax`;

    // Aynı cookie bazen Secure/HttpOnly ile setlenmiş oluyor.
    // Silme tarafında birden fazla varyant basmak en güvenlisi.
    const kill = (name) => ([
      `${name}=; ${base}`,
      `${name}=; ${base}; Secure`,
      `${name}=; ${base}; HttpOnly`,
      `${name}=; ${base}; Secure; HttpOnly`,
    ]);

    const cookies = [
      ...kill("aivo_sess"),     // KV session cookie
      ...kill("aivo_session"),  // legacy JWT cookie
    ];

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    // Çoklu Set-Cookie
    res.setHeader("Set-Cookie", cookies);

    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    // Logout asla 500 vermesin: yine 200 dön
    try {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ ok: true, soft: true, err: String(e?.message || e) }));
    } catch (_) {}
  }
}
