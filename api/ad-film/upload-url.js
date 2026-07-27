// api/ad-film/upload-url.js
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createRequire } from "module";
import {
  buildPublicUrl,
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  sendJson,
} from "../_lib/ad-film-projects.js";

const require = createRequire(import.meta.url);
const { enforceMediaPolicy, mediaPolicyError } = require("../_lib/media-policy.js");

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
    allowed: new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
    ]),
    folder: "extra-media",
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
  return type;
}

function createR2Client() {
  const endpoint =
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : "");

  if (!endpoint) throw new Error("missing_env:R2_ENDPOINT_or_R2_ACCOUNT_ID");
  if (!process.env.R2_ACCESS_KEY_ID) throw new Error("missing_env:R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error("missing_env:R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
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

    if (!projectId) {
      return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    }
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
    if (!project) {
      return sendJson(res, 404, { ok: false, error: "project_not_found" });
    }

    if (contentType.startsWith("image/") && contentType !== "image/svg+xml") {
      const policy = await enforceMediaPolicy({
        app: "adfilm",
        fileName: filename,
        mimeType: contentType,
        source: "adfilm_r2_presign",
        title: project.brief?.productName || filename,
        description: project.brief?.description || filename,
      });
      if (policy?.decision === "block") {
        return sendJson(res, 403, mediaPolicyError(policy));
      }
    }

    const bucket = process.env.R2_BUCKET;
    if (!bucket) throw new Error("missing_env:R2_BUCKET");

    const id = crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex");
    const key = `${mediaPrefix(user, projectId)}${rule.folder}/${Date.now()}-${id}-${filename}`;

    const client = createR2Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: "private, max-age=0, no-cache",
      Metadata: {
        projectid: projectId.slice(0, 64),
        owner: user.ownerHash,
        mediakind: kind,
      },
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 10 * 60 });
    return sendJson(res, 200, {
      ok: true,
      projectId,
      kind,
      key,
      upload_url: uploadUrl,
      public_url: buildPublicUrl(key),
      expiresIn: 600,
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
