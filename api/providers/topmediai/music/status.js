// /pages/api/music/stems.js
// Replicate "stems" wrapper: POST { mode:"create", audio_url } or POST { mode:"status", id }
// On status:succeeded -> downloads replicate.delivery stems and archives them to R2 (idempotent-ish).

import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

// These exist in your repo per tree screenshot:
// /api/providers/replicate/predictions/create.js
// /api/providers/replicate/predictions/status.js
import replicateCreate from "../providers/replicate/predictions/create";
import replicateStatus from "../providers/replicate/predictions/status";

// --------- R2 (S3-compatible) ---------
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getR2Bucket() {
  return process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || "";
}

function getPublicBase() {
  // Example: https://pub-xxxx.r2.dev  OR  https://cdn.aivo.tr
  return (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
}

async function r2Exists(r2, bucket, key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e) {
    // NotFound etc.
    return false;
  }
}

async function r2Put(r2, bucket, key, body, contentType = "audio/mpeg") {
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

// --------- Download with retry (replicate.delivery sometimes 404 immediately after "succeeded") ---------
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, { tries = 10, delayMs = 1200 } = {}) {
  let lastErr = null;

  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return res;

      // If replicate.delivery isn't ready, we often see 404 JSON:
      // {"detail":"requested file not found"}
      lastErr = new Error(`HTTP ${res.status} for ${url}`);
    } catch (e) {
      lastErr = e;
    }

    // backoff: 1.2s, 2.4s, 3.6s... (cap-ish)
    await sleep(delayMs * (i + 1));
  }

  throw lastErr || new Error(`Failed to fetch ${url}`);
}

async function archiveStemToR2({ predictionId, stemName, sourceUrl }) {
  const r2 = getR2Client();
  const bucket = getR2Bucket();
  const publicBase = getPublicBase();

  if (!r2 || !bucket || !publicBase) {
    return {
      archived: false,
      reason: "missing_r2_env",
      source_url: sourceUrl,
      archive_url: null,
    };
  }

  const safeStem = String(stemName || "stem").replace(/[^a-z0-9_-]/gi, "_");
  const key = `stems/${predictionId}/${safeStem}.mp3`;

  // idempotent: if already uploaded, return public url
  if (await r2Exists(r2, bucket, key)) {
    return {
      archived: true,
      reason: "already_exists",
      source_url: sourceUrl,
      archive_url: `${publicBase}/${key}`,
    };
  }

  // download (retry because replicate.delivery can 404 for a while)
  const res = await fetchWithRetry(sourceUrl, { tries: 12, delayMs: 1500 });
  const buf = Buffer.from(await res.arrayBuffer());

  // upload
  await r2Put(r2, bucket, key, buf, "audio/mpeg");

  return {
    archived: true,
    reason: "uploaded",
    source_url: sourceUrl,
    archive_url: `${publicBase}/${key}`,
  };
}

// --------- API Handler ---------
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body || {};
    const mode = String(body.mode || "").toLowerCase();

    if (!mode) {
      return res.status(400).json({ ok: false, error: "missing_mode" });
    }

    // --------- CREATE ---------
    if (mode === "create") {
      const audio_url = body.audio_url;
      if (!audio_url) {
        return res.status(400).json({ ok: false, error: "missing_audio_url" });
      }

      // Delegate to your existing replicate wrapper
      // Expect it to return something like: { ok:true, id, status, urls }
      const createResult = await replicateCreate(
        { method: "POST", body: { audio_url } },
        null,
        { fromInternal: true } // harmless extra hint; your wrapper may ignore
      );

      // In case your wrapper is a normal (req,res) handler, fallback:
      // If it already wrote to res, createResult may be undefined.
      if (!createResult) {
        return res.status(200).json({ ok: true, mode: "create", note: "create_dispatched" });
      }

      return res.status(200).json({ ok: true, mode: "create", ...createResult });
    }

    // --------- STATUS (+ ARCHIVE) ---------
    if (mode === "status") {
      const id = body.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "missing_id" });
      }

      const statusResult = await replicateStatus(
        { method: "POST", body: { id } },
        null,
        { fromInternal: true }
      );

      if (!statusResult) {
        return res.status(200).json({ ok: true, mode: "status", id, note: "status_polled" });
      }

      const status = statusResult.status || statusResult.state || null;
      const output = statusResult.output || null;

      // If succeeded and output is an object of stems -> urls
      // Example output: { bass:"https://replicate.delivery/.../bass.mp3", drums:"...", ... }
      if (status === "succeeded" && output && typeof output === "object") {
        const entries = Object.entries(output).filter(
          ([k, v]) => typeof v === "string" && v.startsWith("http")
        );

        const archived = {};
        for (const [stemName, sourceUrl] of entries) {
          archived[stemName] = await archiveStemToR2({
            predictionId: id,
            stemName,
            sourceUrl,
          });
        }

        return res.status(200).json({
          ok: true,
          mode: "status",
          id,
          status,
          error: statusResult.error ?? null,
          logs: statusResult.logs ?? null,
          // Keep original output, but also return archived map
          output,
          archived,
        });
      }

      return res.status(200).json({ ok: true, mode: "status", ...statusResult });
    }

    // --------- UNKNOWN MODE ---------
    return res.status(400).json({ ok: false, error: "unknown_mode", mode });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: err?.message || String(err),
    });
  }
}
