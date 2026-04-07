import { createAuthSession } from "./login.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({
        ok: false,
        error: "google_oauth_env_missing"
      });
    }

    const code = typeof req.query?.code === "string" ? req.query.code.trim() : "";
    const state = typeof req.query?.state === "string" ? req.query.state.trim() : "";
    const error = typeof req.query?.error === "string" ? req.query.error.trim() : "";

    if (error) {
      const msg = encodeURIComponent("Google girişi iptal edildi.");
      return res.redirect(302, `/?tf=warning&tm=${msg}`);
    }

    if (!code) {
      const msg = encodeURIComponent("Google giriş kodu alınamadı.");
      return res.redirect(302, `/?tf=error&tm=${msg}`);
    }

    let returnTo = "/studio.v2.html";

    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
        const rawReturnTo =
          parsed && typeof parsed.returnTo === "string" ? parsed.returnTo.trim() : "";

        if (rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")) {
          returnTo = rawReturnTo;
        }
      } catch (_) {}
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });

    const tokenData = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[auth/google-callback] token error:", tokenData);
      const msg = encodeURIComponent("Google token alınamadı.");
      return res.redirect(302, `/?tf=error&tm=${msg}`);
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const userData = await userRes.json().catch(() => ({}));

    if (!userRes.ok || !userData.email) {
      console.error("[auth/google-callback] userinfo error:", userData);
      const msg = encodeURIComponent("Google kullanıcı bilgisi alınamadı.");
      return res.redirect(302, `/?tf=error&tm=${msg}`);
    }

     const authUser = {
      provider: "google",
      google_id: userData.id ? String(userData.id) : "",
      email: String(userData.email || "").trim().toLowerCase(),
      name: String(userData.name || userData.given_name || "").trim(),
      avatar_url: String(userData.picture || "").trim(),
      email_verified: userData.verified_email === true
    };

    if (!authUser.email) {
      const msg = encodeURIComponent("Google hesabında email bilgisi bulunamadı.");
      return res.redirect(302, `/?tf=error&tm=${msg}`);
    }

    const kvMod = await import("../_kv.js");
    const kv = kvMod?.default || kvMod || {};
    const kvGetJson = kv.kvGetJson;
    const kvSetJson = kv.kvSetJson;

    if (typeof kvGetJson !== "function" || typeof kvSetJson !== "function") {
      const msg = encodeURIComponent("Kullanıcı verisi servisi hazır değil.");
      return res.redirect(302, `/?tf=error&tm=${msg}`);
    }

    const userKey1 = `user:${authUser.email}`;
    const userKey2 = `users:${authUser.email}`;

    const existing1 = await kvGetJson(userKey1).catch(() => null);
    const existing2 = await kvGetJson(userKey2).catch(() => null);

    const existingUser =
      (existing1 && typeof existing1 === "object")
        ? existing1
        : ((existing2 && typeof existing2 === "object") ? existing2 : null);

    const finalUser = existingUser || {
      email: authUser.email,
      name: authUser.name || "",
      role: "user",
      provider: "google",
      googleId: authUser.google_id || "",
      avatarUrl: authUser.avatar_url || "",
      verified: true,
      createdAt: Date.now()
    };

    await kvSetJson(userKey1, finalUser);
    await kvSetJson(userKey2, finalUser);

    await createAuthSession(res, authUser.email);

    return res.redirect(302, `${returnTo}?tf=success&tm=${encodeURIComponent("Girişiniz başarılı")}`);
  } catch (err) {
    console.error("[auth/google-callback] fatal error:", err);
    const msg = encodeURIComponent("Google girişinde beklenmeyen hata oluştu.");
    return res.redirect(302, `/?tf=error&tm=${msg}`);
  }
};
