// /api/auth/logout.js
const COOKIE_NAME = "aivo_session";

module.exports = (req, res) => {
  try {
    // HTTPS'te Secure eklemek iyi; localhost'ta sorun çıkarmasın diye dinamik
    const isHttps =
      (req.headers["x-forwarded-proto"] || "").includes("https") ||
      (req.headers.referer || "").startsWith("https://");

    const cookie =
      `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` +
      (isHttps ? "; Secure" : "");

    // Tek cookie set etme yetmezse (eski varyantları da öldürmek için) ikinci bir set-cookie daha basabiliriz:
    res.setHeader("Set-Cookie", [
      cookie,
      // Bazı edge/cdn senaryolarında Expires de eklemek iyi olur:
      `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT` +
        (isHttps ? "; Secure" : "")
    ]);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
