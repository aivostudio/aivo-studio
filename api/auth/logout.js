// /api/auth/logout.js
export default async function handler(req, res) {
  try {
    const expires = "Thu, 01 Jan 1970 00:00:00 GMT";

    // LOGIN ile BİREBİR olmalı:
    // Path=/; Domain=.aivo.tr; Secure; SameSite=None
    const baseDomain = `Path=/; Domain=.aivo.tr; Max-Age=0; Expires=${expires}; SameSite=None; Secure`;
    const baseHost   = `Path=/; Max-Age=0; Expires=${expires}; SameSite=None; Secure`; // fallback (Domain set edilmediyse)

    // Aynı cookie bazen HttpOnly ile setlenmiş oluyor.
    // Silme tarafında varyant basmak en güvenlisi.
    const kill = (name) => ([
      // Domain=.aivo.tr (asıl)
      `${name}=; ${baseDomain}`,
      `${name}=; ${baseDomain}; HttpOnly`,

      // Host-only fallback (eski/yanlış set ihtimali)
      `${name}=; ${baseHost}`,
      `${name}=; ${baseHost}; HttpOnly`,
    ]);

    const cookies = [
      ...kill("aivo_sess"),     // KV session cookie
      ...kill("aivo_session"),  // legacy JWT cookie
    ];

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
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
