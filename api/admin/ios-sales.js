// api/admin/ios-sales.js

import crypto from "crypto";
import zlib from "zlib";

const APPLE_ISSUER_ID =
  process.env.APP_STORE_CONNECT_ISSUER_ID ||
  process.env.APPLE_ISSUER_ID ||
  "";

const APPLE_KEY_ID =
  process.env.APP_STORE_CONNECT_KEY_ID ||
  "";

const APPLE_PRIVATE_KEY = String(
  process.env.APP_STORE_CONNECT_PRIVATE_KEY ||
  ""
).replace(/\\n/g, "\n");

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
    const startDate = String(process.env.APPLE_IOS_SALES_START_DATE || "2026-05-20");
    const yesterday = todayMinusDays(1);

    function toDateKey(d) {
      return d.toISOString().slice(0, 10);
    }

    function addDays(dateStr, days) {
      const d = new Date(dateStr + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + days);
      return toDateKey(d);
    }

    function buildSalesUrl(date) {
      return (
        "https://api.appstoreconnect.apple.com/v1/salesReports" +
        "?filter[frequency]=DAILY" +
        "&filter[reportDate]=" + encodeURIComponent(date) +
        "&filter[reportSubType]=SUMMARY" +
        "&filter[reportType]=SALES" +
        "&filter[vendorNumber]=" + encodeURIComponent(APPLE_VENDOR_NUMBER) +
        "&filter[version]=1_0"
      );
    }

    async function fetchSalesRows(date) {
      const r = await fetch(buildSalesUrl(date), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/a-gzip"
        }
      });

      const arrayBuffer = await r.arrayBuffer();
      const bodyBuffer = Buffer.from(arrayBuffer);

      if (!r.ok) {
        return {
          ok: false,
          status: r.status,
          date,
          rows: [],
          error: bodyBuffer.toString("utf8")
        };
      }

      const unzipped = zlib.gunzipSync(bodyBuffer).toString("utf8");
      const rows = parseTsv(unzipped);

      return {
        ok: true,
        status: r.status,
        date,
        rows
      };
    }

    function summarizeRows(rows) {
      const list = Array.isArray(rows) ? rows : [];

      return list.reduce(
        function (acc, row) {
          const units = Number(row.Units || 0);
          const customerPrice = Number(row["Customer Price"] || 0);
          const developerProceeds = Number(row["Developer Proceeds"] || 0);

          acc.units += units;
          acc.customerTotal += customerPrice * units;
          acc.proceedsTotal += developerProceeds * units;

          acc.currency =
            row["Customer Currency"] ||
            row["Currency of Proceeds"] ||
            acc.currency ||
            "TRY";

          return acc;
        },
        {
          units: 0,
          customerTotal: 0,
          proceedsTotal: 0,
          currency: "TRY"
        }
      );
    }

    const selectedReport = await fetchSalesRows(reportDate);

    const totalRows = [];
    const scannedDates = [];

    let cursor = startDate;
    while (cursor <= yesterday) {
      const daily = await fetchSalesRows(cursor);

      scannedDates.push({
        date: cursor,
        ok: daily.ok,
        status: daily.status,
        count: daily.rows.length
      });

      if (daily.ok && daily.rows.length) {
        totalRows.push(...daily.rows);
      }

      cursor = addDays(cursor, 1);
    }

    const selectedSummary = summarizeRows(selectedReport.rows);
    const totalSummary = summarizeRows(totalRows);

    return res.status(200).json({
      ok: true,
      apple_connected: true,
      report_ready: selectedReport.ok,
      status: selectedReport.status,
      date: reportDate,
      vendorNumber: APPLE_VENDOR_NUMBER,

      count: selectedReport.rows.length,
      rows: selectedReport.rows,
      summary: selectedSummary,

      total_count: totalRows.length,
      total_rows: totalRows,
      total_summary: totalSummary,
      total_start_date: startDate,
      total_end_date: yesterday,
      scanned_dates: scannedDates,

      selected_error: selectedReport.ok ? null : selectedReport.error
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "ios_sales_failed"
    });
  }
}
