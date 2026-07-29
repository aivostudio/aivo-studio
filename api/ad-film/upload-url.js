// api/ad-film/upload-url.js
import crypto from "crypto";
import {
  buildPublicUrl,
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  sendJson,
} from "../_lib/ad-film-projects.js";

const RULES = {
  "product-image": {
    maxBytes: 12 * 1024 * 1024,
    allowed: new Set(["image/jpeg", "image/png", "image/webp"]),
    folder: "product-images",
  },
  logo: {
    maxBytes: 5 * 1024 * 1024,
    allowed: new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]),
    folder: "logo",
  },
  "extra-media": {
    maxBytes: 120 * 1024 * 1024,
    allowed: new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]),
    folder: "extra-media",
  },
  "music-track": {
    maxBytes: 20 * 1024 * 1024,
    allowed: new Set([
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/aac",
      "audio/ogg",
      "audio/flac",
      "audio/x-m4a",
    ]),
    folder: "music",
  },
};

function cleanFilename(value) {
  const cleaned = String(value || "upload")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return cleaned || "upload";
}

function normalizeContentType(value) {
  const type = String(value || "").trim().toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (type === "video/mov") return "video/quicktime";
  if (type === "audio/mp3") return "audio/mpeg";
  if (type === "audio/m4a") return "audio/x-m4a";
  return type;
}

function r2Endpoint() {
  return (
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : "")
  );
}

function assertR2Env() {
  const endpoint = r2Endpoint();
  if (!endpoint) throw new Error("missing_env:R2_ENDPOINT_or_R2_ACCOUNT_ID");
  if (!process.env.R2_ACCESS_KEY_ID) throw new Error("missing_env:R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error("missing_env:R2_SECRET_ACCESS_KEY");
  if (!process.env.R2_BUCKET) throw new Error("missing_env:R2_BUCKET");
  return endpoint;
}

function awsEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodePath(value) {
  return String(value)
    .split("/")
    .map((part) => awsEncode(part))
    .join("/");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key, value, encoding) {
  const digest = crypto.createHmac("sha256", key).update(value, "utf8");
  return encoding ? digest.digest(encoding) : digest.digest();
}

function createSignedR2Url({ method, endpoint, bucket, key, expiresIn }) {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const parsed = new URL(endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const basePath = parsed.pathname.replace(/\/+$/, "");
  const canonicalUri = `${basePath}/${awsEncode(bucket)}/${encodePath(key)}`.replace(/^([^/])/, "/$1");
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.max(60, Math.min(21600, Number(expiresIn) || 600))),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((name) => `${awsEncode(name)}=${awsEncode(query[name])}`)
    .join("&");
  const canonicalRequest = [
    String(method || "GET").toUpperCase(),
    canonicalUri,
    canonicalQuery,
    `host:${parsed.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");
  const kDate = hmac(Buffer.from(`AWS4${secretAccessKey}`, "utf8"), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");
  return `${parsed.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        route: "ad-film-upload-url",
        signer: "native-sigv4",
      });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = String(req.body?.projectId || "").trim();
    const filename = cleanFilename(req.body?.filename);
    const contentType = normalizeContentType(req.body?.contentType);
    const size = Number(req.body?.size || 0);
    const kind = String(req.body?.kind || "").trim().toLowerCase();
    const rule = RULES[kind];

    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    if (!rule) {
      return sendJson(res, 400, {
        ok: false,
        error: "invalid_media_kind",
        allowed: Object.keys(RULES),
      });
    }
    if (!rule.allowed.has(contentType)) {
      return sendJson(res, 400, {
        ok: false,
        error: "invalid_content_type",
        allowed: Array.from(rule.allowed),
      });
    }
    if (!Number.isFinite(size) || size <= 0 || size > rule.maxBytes) {
      return sendJson(res, 400, {
        ok: false,
        error: "invalid_file_size",
        maxBytes: rule.maxBytes,
      });
    }

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const endpoint = assertR2Env();
    const bucket = process.env.R2_BUCKET;
    const id = crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex");
    const key = `${mediaPrefix(user, projectId)}${rule.folder}/${Date.now()}-${id}-${filename}`;

    const uploadUrl = createSignedR2Url({
      method: "PUT",
      endpoint,
      bucket,
      key,
      expiresIn: 10 * 60,
    });
    const readUrl = createSignedR2Url({
      method: "GET",
      endpoint,
      bucket,
      key,
      expiresIn: 6 * 60 * 60,
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      kind,
      key,
      upload_url: uploadUrl,
      read_url: readUrl,
      public_url: buildPublicUrl(key),
      expiresIn: 600,
      readExpiresIn: 21600,
      required_headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error("[ad-film/upload-url]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
