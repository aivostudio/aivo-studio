// /api/auth/verify.js
import crypto from "crypto";
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;
const kvSetJson = kv.kvSetJson;
const kvDel =
  kv.kvDel || kv.kvDelKey || kv.kvDelSafe || kv.kvDelJson || null;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function delSafe(key) {
  try {
    if (typeof kvDel === "function") return await kvDel(key);
  } catch (_) {}
  return null;
}

function renderIosVerifySuccessPage(res, email) {
  const safeEmail = encodeURIComponent(String(email || ""));
  const appUrl = `aivo://studio?verified=1&email=${safeEmail}`;
  const fallbackUrl = `/login.ios.html?returnTo=/studio.ios.html&verified=1&email=${safeEmail}`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>AIVO Hesap Doğrulandı</title>
  <style>
    html,body{margin:0;min-height:100%;background:#070817;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:100%;max-width:420px;border:1px solid rgba(255,255,255,.14);border-radius:28px;padding:28px;background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.04));box-shadow:0 24px 80px rgba(0,0,0,.45);text-align:center}
    .icon{width:68px;height:68px;border-radius:22px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#7c3aed,#06b6d4);font-size:34px}
    h1{font-size:24px;line-height:1.2;margin:0 0 10px}
    p{margin:0 0 22px;color:rgba(255,255,255,.72);font-size:15px;line-height:1.5}
    a{display:block;text-decoration:none;color:#fff;background:linear-gradient(135deg,#7c3aed,#06b6d4);border-radius:18px;padding:15px 18px;font-weight:800}
    .small{margin-top:16px;font-size:12px;color:rgba(255,255,255,.48)}
  </style>
</head>
<body>
  <main class="card">
    <div class="icon">✓</div>
    <h1>AIVO hesabınız doğrulandı</h1>
    <p>Uygulamaya geri dönebilirsiniz.</p>
    <a href="${appUrl}">AIVO'yu Aç</a>
    <div class="small">Uygulama açılmazsa AIVO'yu manuel olarak açın.</div>
  </main>
  <script>
    setTimeout(function () {
      window.location.href = "${appUrl}";
    }, 700);

    setTimeout(function () {
      window.location.href = "${fallbackUrl}";
    }, 2500);
  </script>
</body>
</html>`);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }

    if (typeof kvGetJson !== "function" || typeof kvSetJson !== "function") {
      return json(res, 503, { ok: false, error: "kv_not_available" });
    }

    const token = String(req.query?.token || "").trim();
    if (!token) return json(res, 400, { ok: false, error: "missing_token" });

    const verifyKey = `verify:${token}`;
    const payload = await kvGetJson(verifyKey).catch(() => null);

      if (!payload || typeof payload !== "object") {
      const from = req.query?.from ? String(req.query.from).trim().toLowerCase() : "";
      const returnToRaw = req.query?.returnTo ? String(req.query.returnTo).trim() : "";

      let expiredLocation = "/login.html?returnTo=/studio.v2.html";

      if (returnToRaw && returnToRaw.startsWith("/")) {
        expiredLocation = returnToRaw;
      } else if (from === "ios") {
        expiredLocation = "/login.ios.html?returnTo=/studio.ios.html";
      } else if (from === "play" || from === "android") {
        expiredLocation = "/login.play.html?returnTo=/studio.play.html";
      } else if (from === "mobile") {
        expiredLocation = "/login.mobile.html?returnTo=/studio.mobile.html";
      }

      const joiner = expiredLocation.includes("?") ? "&" : "?";
      const finalExpiredLocation = `${expiredLocation}${joiner}verify=expired`;

      res.statusCode = 302;
      res.setHeader("Location", finalExpiredLocation);
      res.end();
      return;
    }

    const verifiedEmail = normalizeEmail(payload.email);
    if (!verifiedEmail || !verifiedEmail.includes("@")) {
      return json(res, 400, { ok: false, error: "bad_payload_missing_email" });
    }

    // ✅ ban kontrol
    const banned = await kvGetJson(`ban:${verifiedEmail}`).catch(() => null);
    if (banned) {
      await delSafe(verifyKey);
      return json(res, 403, { ok: false, error: "user_banned" });
    }

    const now = Date.now();

    // ✅ mevcut user varsa çek (OVERWRITE ETME)
    const existing = await kvGetJson(`user:${verifiedEmail}`).catch(() => null);

    const next = {
      id: existing?.id || payload.id || crypto.randomUUID(),
      email: verifiedEmail,
      name: payload.name || existing?.name || "",
      role: existing?.role || payload.role || "user",
      createdAt: existing?.createdAt || payload.createdAt || now,
      updatedAt: now,
      verified: true,
      disabled: existing?.disabled === true ? true : false,
      // 🔥 kritik: passwordHash varsa yaz, yoksa eskisini KORU
      passwordHash: payload.passwordHash || existing?.passwordHash || undefined,
    };

    Object.keys(next).forEach((k) => next[k] === undefined && delete next[k]);

    await kvSetJson(`user:${verifiedEmail}`, next);

    // verify tokenı temizle
    await delSafe(verifyKey);

    // ✅ Verify success redirect
    const from = req.query?.from ? String(req.query.from).trim().toLowerCase() : "";
    const returnToRaw = req.query?.returnTo ? String(req.query.returnTo).trim() : "";
    const email = verifiedEmail;

     if (from === "ios") {
      return renderIosVerifySuccessPage(res, email);
    }

    if (returnToRaw && returnToRaw.startsWith("/")) {
      const joiner = returnToRaw.includes("?") ? "&" : "?";
      const safeLocation =
        `${returnToRaw}${joiner}verified=1&email=${encodeURIComponent(email)}`;

      res.statusCode = 302;
      res.setHeader("Location", safeLocation);
      res.end();
      return;
    }

    let fallbackLocation = "/login.html?returnTo=/studio.v2.html";

    if (from === "ios") {
      fallbackLocation = "/login.ios.html?returnTo=/studio.ios.html";
    } else if (from === "play" || from === "android") {
      fallbackLocation = "/login.play.html?returnTo=/studio.play.html";
    } else if (from === "mobile") {
      fallbackLocation = "/login.mobile.html?returnTo=/studio.mobile.html";
    }

    const joiner = fallbackLocation.includes("?") ? "&" : "?";
    const finalLocation =
      `${fallbackLocation}${joiner}verified=1&email=${encodeURIComponent(email)}`;

    res.statusCode = 302;
    res.setHeader("Location", finalLocation);
    res.end();
    return;
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "verify_failed",
      message: String(e?.message || e),
    });
  }
}
