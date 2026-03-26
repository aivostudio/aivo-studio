// /api/photofx/overlay-logo.js

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { neon } from "@neondatabase/serverless";

const POS = {
  br: "W-w-24:H-h-24",
  bl: "24:H-h-24",
  tr: "W-w-24:24",
  tl: "24:24",
  c: "(W-w)/2:(H-h)/2",
};

const SIZE = {
  sm: 0.18,
  md: 0.28,
  lg: 0.38,
};

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(err || `process_failed:${code}`));
    });
  });
}

function getConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function isUuidLike(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(id || "")
  );
}

async function uploadFileToR2({ filePath, key, contentType }) {
  const pres = await fetch("https://aivo.tr/api/r2/presign-put", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      filename: path.basename(key || "logo-overlay.mp4"),
      contentType: contentType || "video/mp4",
      key,
    }),
  });

  const presJ = await pres.json().catch(() => null);

  if (!pres.ok || !presJ || !presJ.ok) {
    throw new Error(
      `presign_failed:${pres.status}:${JSON.stringify(presJ || null)}`
    );
  }

  const uploadUrl = String(presJ.upload_url || "");
  const publicUrl = String(presJ.public_url || "");
  const finalKey = String(presJ.key || key || "");

  if (!uploadUrl || !publicUrl || !finalKey) {
    throw new Error(`presign_missing_urls:${JSON.stringify(presJ || null)}`);
  }

  const body = fs.readFileSync(filePath);

  const putResp = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType || "video/mp4",
      "Content-Length": String(body.length),
    },
    body,
  });

  if (!putResp.ok) {
    const t = await putResp.text().catch(() => "");
    throw new Error(
      `r2_put_failed:${putResp.status}:${String(t || "").slice(0, 600)}`
    );
  }

  return {
    publicUrl,
    finalKey,
  };
}

async function verifyPublicUrl(url, label) {
  if (!url) throw new Error(`public_url_missing:${label}`);

  const methods = ["HEAD", "GET"];

  for (const method of methods) {
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
        };
      }
    } catch {}
  }

  throw new Error(`public_url_unreachable:${label}:${url}`);
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_failed:${res.status}`);
  const ab = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(ab));
}

async function probeVideoBitrate(inputPath) {
  return await new Promise((resolve) => {
    const p = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=bit_rate",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        inputPath,
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );

    let out = "";
    p.stdout.on("data", (d) => {
      out += d.toString();
    });

    p.on("close", () => {
      const n = Number(String(out || "").trim());
      resolve(Number.isFinite(n) && n > 0 ? n : null);
    });

    p.on("error", () => resolve(null));
  });
}

function pickVariant(o) {
  return String(o?.meta?.variant || "").toLowerCase().trim();
}

function isVideo(o) {
  return String(o?.type || "").toLowerCase().trim() === "video";
}

function upsertVideoOutput(outputs, variant, url, extraMeta = {}) {
  const arr = Array.isArray(outputs) ? outputs.slice() : [];

  const idx = arr.findIndex(
    (o) => isVideo(o) && pickVariant(o) === String(variant || "").toLowerCase()
  );

  const item = {
    type: "video",
    url,
    meta: {
      app: "photofx",
      variant,
      ...(extraMeta || {}),
    },
  };

  if (idx >= 0) {
    arr[idx] = {
      ...(arr[idx] || {}),
      ...item,
      meta: { ...((arr[idx] || {}).meta || {}), ...(item.meta || {}) },
    };
    return arr;
  }

  arr.unshift(item);
  return arr;
}

export default async function handler(req, res) {
  const cleanup = [];

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const {
      job_id,
      video_url,
      logo_url,
      logo_pos = "br",
      logo_size = "sm",
      logo_opacity = 0.85,
    } = req.body || {};

    if (!job_id) {
      return res.status(400).json({ ok: false, error: "job_id_required" });
    }

    if (!isUuidLike(job_id)) {
      return res.status(400).json({ ok: false, error: "job_id_invalid" });
    }

    if (!video_url || !logo_url) {
      return res.status(400).json({ ok: false, error: "missing_inputs" });
    }

    const conn = getConn();
    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    const sql = neon(conn);

    const rows = await sql`
      select id, app, outputs, meta
      from jobs
      where lower(app) = 'photofx'
        and (
          id::text = ${job_id}
          or id = ${job_id}::uuid
        )
      limit 1
    `;

    const job = rows[0] || null;

    if (!job) {
      return res.status(404).json({ ok: false, error: "job_not_found" });
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aivo-photofx-overlay-"));
    const inputVideo = path.join(tmpDir, `in-${job_id}.mp4`);
    const inputLogo = path.join(tmpDir, `logo-${job_id}.png`);
    const outputVideo = path.join(tmpDir, `out-${job_id}.mp4`);

    cleanup.push(inputVideo, inputLogo, outputVideo, tmpDir);

    await download(video_url, inputVideo);
    await download(logo_url, inputLogo);

    const pos = POS[String(logo_pos || "").trim()] || POS.br;
    const sizeRatio = SIZE[String(logo_size || "").trim()] || SIZE.sm;
    const opacity = Math.max(0, Math.min(1, Number(logo_opacity)));

    const sourceBitrate = await probeVideoBitrate(inputVideo);
    const targetBitrate = sourceBitrate
      ? Math.max(1200000, Math.round(sourceBitrate * 0.98))
      : 8000000;

    const filter = [
      `[1:v][0:v]scale2ref=w=main_w*${sizeRatio}:h=ow/mdar[lg][base]`,
      `[lg]format=rgba,colorchannelmixer=aa=${opacity}[lg2]`,
      `[base][lg2]overlay=${pos}:format=auto[v]`,
    ].join(";");

    await run(ffmpegPath, [
      "-y",
      "-i",
      inputVideo,
      "-i",
      inputLogo,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      "0:a:0?",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-b:v",
      String(targetBitrate),
      "-maxrate",
      String(targetBitrate),
      "-bufsize",
      String(targetBitrate * 2),
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      "-shortest",
      "-movflags",
      "+faststart",
      outputVideo,
    ]);

    const requestedKey = `outputs/photofx/${job_id}/logo-overlay-${Date.now()}.mp4`;

    const { publicUrl, finalKey } = await uploadFileToR2({
      filePath: outputVideo,
      key: requestedKey,
      contentType: "video/mp4",
    });

    await verifyPublicUrl(publicUrl, "logo_overlay");

    const outputs = Array.isArray(job.outputs) ? job.outputs : [];
    const nextOutputs = upsertVideoOutput(outputs, "logo_overlay", publicUrl, {
      is_logo_overlay: true,
      is_final: false,
      logo_url,
      logo_pos: String(logo_pos || "br").trim(),
      logo_size: String(logo_size || "sm").trim(),
      logo_opacity: opacity,
    });

    const patchMeta = {
      logo_enabled: true,
      logo_url: String(logo_url || "").trim(),
      logo_overlay_url: publicUrl,
      logo_overlay_key: finalKey,
      logo_overlay_applied_at: new Date().toISOString(),
      logo_pos: String(logo_pos || "br").trim(),
      logo_size: String(logo_size || "sm").trim(),
      logo_opacity: opacity,
      logo_overlay_source_url: String(video_url || "").trim(),
      logo_overlay_source_bitrate: sourceBitrate,
      logo_overlay_target_bitrate: targetBitrate,
    };

    await sql`
      update jobs
      set
        outputs = ${JSON.stringify(nextOutputs)}::jsonb,
        meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patchMeta)}::jsonb,
        updated_at = now()
      where id = ${job_id}::uuid
    `;

    return res.json({
      ok: true,
      url: publicUrl,
      job_id,
      video_bitrate: sourceBitrate,
      target_bitrate: targetBitrate,
      variant: "logo_overlay",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "overlay_failed",
      message: e?.message || String(e),
    });
  } finally {
    for (const f of cleanup.reverse()) {
      try {
        if (!f) continue;
        if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
          fs.rmSync(f, { recursive: true, force: true });
        } else if (fs.existsSync(f)) {
          fs.unlinkSync(f);
        }
      } catch {}
    }
  }
}
