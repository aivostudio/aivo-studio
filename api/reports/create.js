"use strict";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function safeString(value, maxLength) {
  const text = String(value == null ? "" : value).trim();
  if (!maxLength || text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}

function normalizeApp(value) {
  const app = safeString(value, 40).toLowerCase();

  if (
    app === "video" ||
    app === "photofx" ||
    app === "cartoon" ||
    app === "lipsync" ||
    app === "atmo" ||
    app === "cover" ||
    app === "music"
  ) {
    return app;
  }

  return "unknown";
}

function normalizeSource(value) {
  const source = safeString(value, 80).toLowerCase();

  if (source) return source;

  return "mobile_app";
}

function getClientIp(req) {
  const forwarded = safeString(req.headers["x-forwarded-for"], 300);
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return safeString(req.socket && req.socket.remoteAddress, 120);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  return await new Promise(function(resolve, reject) {
    let raw = "";

    req.on("data", function(chunk) {
      raw += chunk;

      if (raw.length > 64 * 1024) {
        reject(new Error("body_too_large"));
        req.destroy();
      }
    });

    req.on("end", function() {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("invalid_json"));
      }
    });

    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return sendJson(res, 200, {
      ok: true
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "method_not_allowed"
    });
  }

  let body;

  try {
    body = await readJsonBody(req);
  } catch (err) {
    return sendJson(res, 400, {
      ok: false,
      error: err && err.message ? err.message : "invalid_request_body"
    });
  }

  const app = normalizeApp(body.app);
  const jobId = safeString(body.job_id || body.jobId || body.id, 160);
  const contentUrl = safeString(body.content_url || body.contentUrl || body.url, 2000);
  const reason = safeString(body.reason, 240);
  const details = safeString(body.details, 1000);
  const source = normalizeSource(body.source);
  const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
    ? body.meta
    : {};

  if (!reason) {
    return sendJson(res, 400, {
      ok: false,
      error: "reason_required"
    });
  }

  const report = {
    id: "report_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10),
    created_at: new Date().toISOString(),
    app: app,
    job_id: jobId,
    content_url: contentUrl,
    reason: reason,
    details: details,
    source: source,
    meta: {
      ...meta,
      user_agent: safeString(req.headers["user-agent"], 500),
      ip: getClientIp(req)
    }
  };

  console.log("[AIVO_CONTENT_REPORT]", JSON.stringify(report));

  return sendJson(res, 200, {
    ok: true,
    received: true,
    report_id: report.id
  });
};
