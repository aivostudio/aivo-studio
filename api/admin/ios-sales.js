// api/admin/ios-sales.js

import crypto from "crypto";

const APPLE_ISSUER_ID = process.env.APPLE_ISSUER_ID || "";
const APPLE_KEY_ID = process.env.APPLE_KEY_ID || "";
const APPLE_PRIVATE_KEY = (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

function createAppleJwt() {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "ES256",
    kid: APPLE_KEY_ID,
    typ: "JWT"
  };

  const payload = {
    iss: APPLE_ISSUER_ID,
    iat: now,
    exp: now + 60 * 20,
    aud: "appstoreconnect-v1"
  };

  const enc = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

  const unsigned = `${enc(header)}.${enc(payload)}`;

  const sign = crypto.createSign("SHA256");
  sign.update(unsigned);
  sign.end();

  const signature = sign
    .sign({ key: APPLE_PRIVATE_KEY, dsaEncoding: "ieee-p1363" })
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${unsigned}.${signature}`;
}

export default async function handler(req, res) {
  try {
    const token = createAppleJwt();

    const r = await fetch(
      "https://api.appstoreconnect.apple.com/v1/apps",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );

    const text = await r.text();

    return res.status(200).json({
      ok: true,
      apple_connected: r.ok,
      status: r.status,
      raw: text ? JSON.parse(text) : null
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "ios_sales_failed"
    });
  }
}
