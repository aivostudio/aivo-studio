// /api/home/finalize-image.js
// CommonJS
// Home image finalize:
// input: slug + image_name + input_url
// işlem: resmi indir + R2 upload
// output: image_url

import { putObject } from "../_lib/r2.js";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ALLOWED_SLUGS = new Set(["cartoon", "photofx"]);

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function getExtFromName(name) {
  const ext = path.extname(String(name || "").trim().toLowerCase());
  if (!ext) return ".jpg";
  if (!MIME_BY_EXT[ext]) return ".jpg";
  return ext;
}

function sanitizeBaseName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
}

async function uploadFileToR2({ filePath, key, contentType }) {
  const body = fs.createReadStream(filePath);

  return await putObject({
    key,
    body,
    contentType,
    cacheControl: "public, max-age=31536000, immutable",
    contentDisposition: "inline",
  });
}

async function downloadToFile(url, outPath) {
  const r = await fetch(url, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });

  if (!r.ok) {
    throw new Error(`download_failed:${r.status}`);
  }

  const buf = Buffer.from(await r.arrayBuffer());
  await fsp.writeFile(outPath, buf);
}

async function verifyPublicUrl(url, label) {
  if (!url) throw new Error(`public_url_missing:${label}`);

  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, {
        method,
        cache: "no-store",
        redirect: "follow",
      });

      if (r.ok) {
        return {
          ok: true,
          status: r.status,
          method,
          contentType: r.headers.get("content-type") || "",
          contentLength: r.headers.get("content-length") || "",
        };
      }
    } catch (_) {}
  }

  throw new Error(`public_url_unreachable:${label}:${url}`);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let tmpDir = null;

  try {
    const body = req.body || {};
    const slug = String(body.slug || "").trim().toLowerCase();
    const image_name = String(body.image_name || "").trim();
    const input_url = String(body.input_url || "").trim();

    if (!slug) {
      return res.status(400).json({ ok: false, error: "slug_required" });
    }

    if (!ALLOWED_SLUGS.has(slug)) {
      return res.status(400).json({
        ok: false,
        error: "slug_invalid",
        allowed: Array.from(ALLOWED_SLUGS),
      });
    }

    if (!image_name) {
      return res.status(400).json({ ok: false, error: "image_name_required" });
    }

    if (!input_url) {
      return res.status(400).json({ ok: false, error: "input_url_required" });
    }

    const ext = getExtFromName(image_name);
    const contentType = MIME_BY_EXT[ext];
    const safeBase = sanitizeBaseName(image_name);

    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "aivo-home-image-"));

    const inputPath = path.join(tmpDir, `${safeBase}${ext}`);

    await downloadToFile(input_url, inputPath);

    const ts = Date.now();
    const imageKey = `outputs/home/${slug}/${safeBase}-${ts}${ext}`;

    const image_url = await uploadFileToR2({
      filePath: inputPath,
      key: imageKey,
      contentType,
    });

    await verifyPublicUrl(image_url, "image");

    return res.status(200).json({
      ok: true,
      slug,
      image_name,
      input_url,
      image_url,
      image_key: imageKey,
      step: "home_image_finalized",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }
};
