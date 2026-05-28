// api/admin/ios-sales.js

import crypto from "crypto";
import zlib from "zlib";

const APPLE_ISSUER_ID = process.env.APPLE_ISSUER_ID || "";
const APPLE_KEY_ID = process.env.APPLE_KEY_ID || "";
const APPLE_PRIVATE_KEY = (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const APPLE_VENDOR_NUMBER = process.env.APPLE_VENDOR_NUMBER || "";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

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

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

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

function todayMinusDays(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function parseTsv(text) {
  const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t");

  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] || "";
    });
    return row;
  });
}

export default async function handler(req, res) {
  try {
    if (!APPLE_ISSUER_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY || !APPLE_VENDOR_NUMBER) {
      return res.status(500).json({
        ok: false,
        error: "missing_apple_env"
      });
    }

    const token = createAppleJwt();
    const reportDate = String(req.query.date || todayMinusDays(1));

    const url =
      "https://api.appstoreconnect.apple.com/v1/salesReports" +
      "?filter[frequency]=DAILY" +
      "&filter[reportDate]=" + encodeURIComponent(reportDate) +
      "&filter[reportSubType]=SUMMARY" +
      "&filter[reportType]=SALES" +
      "&filter[vendorNumber]=" + encodeURIComponent(APPLE_VENDOR_NUMBER) +
      "&filter[version]=1_0";

    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/a-gzip"
      }
    });

    const arrayBuffer = await r.arrayBuffer();
    const bodyBuffer = Buffer.from(arrayBuffer);

    if (!r.ok) {
      const rawError = bodyBuffer.toString("utf8");
      return res.status(200).json({
        ok: false,
        apple_connected: true,
        report_ready: false,
        status: r.status,
        date: reportDate,
        error: rawError
      });
    }

    const unzipped = zlib.gunzipSync(bodyBuffer).toString("utf8");
    const rows = parseTsv(unzipped);

    return res.status(200).json({
      ok: true,
      apple_connected: true,
      report_ready: true,
      status: r.status,
      date: reportDate,
      vendorNumber: APPLE_VENDOR_NUMBER,
      count: rows.length,
      rows
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "ios_sales_failed"
    });
  }
}
