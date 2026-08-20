// /api/auth/logout-ios.js

import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvDel = kv.kvDel;

function parseCookies(header) {
  const out = {};

  if (!header) return out;

  String(header)
    .split(";")
    .forEach((part) => {
      const index = part.indexOf("=");

      if (index === -1) return;

      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();

      if (key) {
        out[key] = value;
      }
    });

  return out;
}

export default async function handler(req, res) {
  try {
    const cookies = parseCookies(req.headers.cookie || "");

    const sid = cookies.aivo_sess || "";

    if (sid && typeof kvDel === "function") {
      await kvDel(`sess:${sid}`);
    }

    const expires = "Thu, 01 Jan 1970 00:00:00 GMT";

    const baseDomain =
      `Path=/; Domain=.aivo.tr; Max-Age=0; Expires=${expires}; SameSite=None; Secure`;

    const baseHost =
      `Path=/; Max-Age=0; Expires=${expires}; SameSite=None; Secure`;

    const killCookie = (name) => [
      `${name}=; ${baseDomain}`,
      `${name}=; ${baseDomain}; HttpOnly`,
      `${name}=; ${baseHost}`,
      `${name}=; ${baseHost}; HttpOnly`
    ];

    const expiredCookies = [
      ...killCookie("aivo_sess"),
      ...killCookie("aivo_session")
    ];

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", expiredCookies);

    res.end(
      JSON.stringify({
        ok: true,
        ios: true,
        sessionDeleted: Boolean(sid)
      })
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    res.end(
      JSON.stringify({
        ok: false,
        error: "ios_logout_failed"
      })
    );
  }
}
