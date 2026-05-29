import crypto from "crypto";
import { createAuthSession } from "./login.js";

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeJwtPayload(token) {
  const part = String(token || "").split(".")[1] || "";
  if (!part) return null;
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function makeAppleClientSecret() {
  const teamId = process.env.APPLE_TEAM_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const keyId = process.env.APPLE_KEY_ID;
const privateKey = String(process.env.APPLE_PRIVATE_KEY || "")
  .replace(/\\n/g, "\n")
  .replace(/^"|"$/g, "")
  .trim();

  if (!teamId || !clientId || !keyId || !privateKey) {
    throw new Error("apple_env_missing");
  }

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT"
  };

  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 30,
    aud: "https://appleid.apple.com",
    sub: clientId
  };

  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const signature = crypto.sign(
    "sha256",
    Buffer.from(data),
    {
      key: privateKey,
    }
  );

  return `${data}.${base64url(signature)}`;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");

  const type = String(req.headers["content-type"] || "");

  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      res.setHeader("Allow", "POST, GET");
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const clientId = process.env.APPLE_CLIENT_ID;
    const redirectUri = process.env.APPLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.redirect(302, `/?open=login&tf=error&tm=${encodeURIComponent("Apple giriş ayarları eksik.")}`);
    }

    const body = req.method === "POST" ? await readBody(req) : {};
    const src = req.method === "POST" ? body : req.query;

    const code = typeof src?.code === "string" ? src.code.trim() : "";
    const state = typeof src?.state === "string" ? src.state.trim() : "";
    const error = typeof src?.error === "string" ? src.error.trim() : "";

    let returnTo = "/studio.v2.html";
    let fallbackLogin = "/?open=login";

    if (error) {
      return res.redirect(302, `${fallbackLogin}&tf=warning&tm=${encodeURIComponent("Apple girişi iptal edildi.")}`);
    }

    if (!code) {
      return res.redirect(302, `${fallbackLogin}&tf=error&tm=${encodeURIComponent("Apple giriş kodu alınamadı.")}`);
    }

    const cookieHeader = String(req.headers?.cookie || "");
    const cookieMap = Object.fromEntries(
      cookieHeader
        .split(";")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((part) => {
          const idx = part.indexOf("=");
          if (idx === -1) return [part, ""];
          return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
        })
    );

    const stateCookie = String(cookieMap.aivo_apple_state || "").trim();

    if (!state) {
      return res.redirect(302, `${fallbackLogin}&tf=error&tm=${encodeURIComponent("Apple state bilgisi eksik.")}`);
    }

    try {
      const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
      const rawReturnTo = typeof parsed?.returnTo === "string" ? parsed.returnTo.trim() : "";
      const stateNonce = typeof parsed?.nonce === "string" ? parsed.nonce.trim() : "";

      if (!stateNonce || !stateCookie || stateNonce !== stateCookie) {
        return res.redirect(302, `${fallbackLogin}&tf=error&tm=${encodeURIComponent("Apple doğrulama oturumu eşleşmedi.")}`);
      }

      if (rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")) {
        returnTo = rawReturnTo;
      }
    } catch {
      return res.redirect(302, `${fallbackLogin}&tf=error&tm=${encodeURIComponent("Apple state verisi çözülemedi.")}`);
    }

    const prevSetCookie = res.getHeader("Set-Cookie");
    const nextCookies = Array.isArray(prevSetCookie)
      ? prevSetCookie.slice()
      : (prevSetCookie ? [prevSetCookie] : []);

    nextCookies.push(
      `aivo_apple_state=; Path=/; Domain=.aivo.tr; HttpOnly; SameSite=Lax; Secure; Max-Age=0`
    );

    res.setHeader("Set-Cookie", nextCookies);

    const clientSecret = makeAppleClientSecret();

    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
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

    if (!tokenRes.ok || !tokenData.id_token) {
      console.error("[auth/apple-callback] token error:", tokenData);
      return res.redirect(302, `${fallbackLogin}&tf=error&tm=${encodeURIComponent("Apple token alınamadı.")}`);
    }

    const appleUser = decodeJwtPayload(tokenData.id_token);

    const email = String(appleUser?.email || "").trim().toLowerCase();
    const appleSub = String(appleUser?.sub || "").trim();

    if (!email || !appleSub) {
      return res.redirect(302, `${fallbackLogin}&tf=error&tm=${encodeURIComponent("Apple hesabından email alınamadı.")}`);
    }

    const kvMod = await import("../_kv.js");
    const kv = kvMod?.default || kvMod || {};
    const kvGetJson = kv.kvGetJson;
    const kvSetJson = kv.kvSetJson;

    if (typeof kvGetJson !== "function" || typeof kvSetJson !== "function") {
      return res.redirect(302, `${fallbackLogin}&tf=error&tm=${encodeURIComponent("Kullanıcı verisi servisi hazır değil.")}`);
    }

    const userKey1 = `user:${email}`;
    const userKey2 = `users:${email}`;

    const existing1 = await kvGetJson(userKey1).catch(() => null);
    const existing2 = await kvGetJson(userKey2).catch(() => null);

    const existingUser =
      existing1 && typeof existing1 === "object"
        ? existing1
        : (existing2 && typeof existing2 === "object" ? existing2 : null);

    const finalUser = existingUser || {
      email,
      name: "",
      role: "user",
      provider: "apple",
      appleId: appleSub,
      verified: true,
      createdAt: Date.now()
    };

    finalUser.provider = finalUser.provider || "apple";
    finalUser.appleId = finalUser.appleId || appleSub;
    finalUser.verified = true;

    await kvSetJson(userKey1, finalUser);
    await kvSetJson(userKey2, finalUser);

    await createAuthSession(res, email);

    return res.redirect(302, `${returnTo}?tf=success&tm=${encodeURIComponent("Girişiniz başarılı")}`);
  } catch (err) {
    console.error("[auth/apple-callback] fatal error:", err);
    return res.redirect(302, `/?open=login&tf=error&tm=${encodeURIComponent("Apple girişinde beklenmeyen hata oluştu.")}`);
  }
}
