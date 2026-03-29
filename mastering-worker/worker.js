// mastering-worker/worker.js
// Step 1: queued PhotoFX job alma iskeleti
// Bu versiyon HENÜZ ffmpeg render yapmaz.
// Sadece DB'den queued photofx job alır ve source/effect meta'yı çıkarır.

import { neon } from "@neondatabase/serverless";

function getConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function pickUrl(o) {
  return String(
    o?.archive_url ||
      o?.url ||
      o?.video_url ||
      o?.meta?.archive_url ||
      o?.meta?.url ||
      o?.meta?.video_url ||
      ""
  ).trim();
}

function normVariant(o) {
  return String(o?.meta?.variant || "").toLowerCase().trim();
}

function isVideo(o) {
  return String(o?.type || "").toLowerCase().trim() === "video";
}

function toArray(v) {
  return Array.isArray(v) ? v : [];
}

function uniqStrings(arr = []) {
  return [...new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))];
}

function normalizeNumber(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

const PHOTOFX_STYLE_ASSET_MAP = {
  "neon-pulse": {
    overlayPaths: [
      "assets/photofx/overlays/light-leaks/",
      "assets/photofx/overlays/prism-lens/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "shake-edit": {
    overlayPaths: ["assets/photofx/overlays/film-burns-flash/"],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "glitch-scan": {
    overlayPaths: [
      "assets/photofx/overlays/vhs-glitch/",
      "assets/photofx/overlays/glitch-noise/",
      "assets/photofx/overlays/hud-graphic-overlay/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "split-flash": {
    overlayPaths: [
      "assets/photofx/overlays/film-burns-flash/",
      "assets/photofx/overlays/light-leaks/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "cinematic-zoom": {
    overlayPaths: [
      "assets/photofx/overlays/dust-particles/",
      "assets/photofx/overlays/light-leaks/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "aura-glow": {
    overlayPaths: [
      "assets/photofx/overlays/prism-lens/",
      "assets/photofx/overlays/light-leaks/",
      "assets/photofx/overlays/dust-particles/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "fire-edge": {
    overlayPaths: [
      "assets/photofx/overlays/sparks-fire/",
      "assets/photofx/overlays/smoke-fog/",
      "assets/photofx/overlays/film-burns-flash/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
  "dark-trap-motion": {
    overlayPaths: [
      "assets/photofx/overlays/smoke-fog/",
      "assets/photofx/overlays/dust-particles/",
      "assets/photofx/overlays/glitch-noise/",
    ],
    lutPaths: ["assets/photofx/luts/cinema-style/"],
  },
};

function resolveEffectMeta(meta = {}) {
  const effects = meta?.effects || {};
  const effectConfig = effects?.effectConfig || {};
  const doseProfile = effectConfig?.doseProfile || {};
  const runtime = effectConfig?.runtime || {};

  const preset = String(
    meta?.preset || effects?.preset || effectConfig?.preset || ""
  )
    .trim()
    .toLowerCase();

  const styles = uniqStrings(
    []
      .concat(toArray(meta?.styles))
      .concat(toArray(effects?.styles))
  ).map((x) => x.toLowerCase());

  const presetAssets =
    PHOTOFX_STYLE_ASSET_MAP[String(preset || "").toLowerCase()] || {};

  const mergedOverlayPaths = uniqStrings(
    (effectConfig?.overlayPaths && effectConfig.overlayPaths.length
      ? effectConfig.overlayPaths
      : presetAssets.overlayPaths || []
    ).filter(Boolean)
  );

  const mergedLutPaths = uniqStrings(
    (effectConfig?.lutPaths && effectConfig.lutPaths.length
      ? effectConfig.lutPaths
      : presetAssets.lutPaths || []
    ).filter(Boolean)
  );

  return {
    preset,
    styles,
    overlayPaths: mergedOverlayPaths,
    lutPaths: mergedLutPaths,
    doseProfile: {
      zoomAmount: normalizeNumber(doseProfile?.zoomAmount, 0.05, 0.0, 0.25),
      shakeAmount: normalizeNumber(doseProfile?.shakeAmount, 0.02, 0.0, 0.2),
      blurAmount: normalizeNumber(doseProfile?.blurAmount, 0.04, 0.0, 0.3),
      glowAmount: normalizeNumber(doseProfile?.glowAmount, 0.08, 0.0, 0.6),
      overlayOpacity: normalizeNumber(
        doseProfile?.overlayOpacity,
        0.18,
        0.0,
        0.7
      ),
      secondaryOpacity: normalizeNumber(
        doseProfile?.secondaryOpacity,
        0.08,
        0.0,
        0.35
      ),
      lutIntensity: normalizeNumber(doseProfile?.lutIntensity, 0.3, 0.0, 1.0),
      maxOverlayCount: normalizeNumber(
        doseProfile?.maxOverlayCount,
        2,
        1,
        4
      ),
      blendMode: String(doseProfile?.blendMode || "screen")
        .trim()
        .toLowerCase(),
    },
    runtime: {
      colorMood: String(runtime?.colorMood || meta?.color_mood || "original")
        .trim()
        .toLowerCase(),
      motionLevel: String(
        runtime?.motionLevel || meta?.motion_level || "balanced"
      )
        .trim()
        .toLowerCase(),
      effectStrength: String(
        runtime?.effectStrength || meta?.effect_strength || "medium"
      )
        .trim()
        .toLowerCase(),
      transitionSpeed: String(
        runtime?.transitionSpeed || meta?.transition_speed || "normal"
      )
        .trim()
        .toLowerCase(),
    },
  };
}

function pickBestSourceOutput(outputs = []) {
  const arr = Array.isArray(outputs) ? outputs : [];

  const variants = [
    "logo_overlay",
    "mux",
    "provider",
    "finalized",
    "preview",
    "effects_applied",
  ];

  for (const variant of variants) {
    const found = arr.find(
      (o) => isVideo(o) && normVariant(o) === variant && pickUrl(o)
    );
    if (found) {
      return {
        variant,
        url: pickUrl(found),
        output: found,
      };
    }
  }

  const anyVideo = arr.find((o) => isVideo(o) && pickUrl(o));
  if (anyVideo) {
    return {
      variant: normVariant(anyVideo) || "video",
      url: pickUrl(anyVideo),
      output: anyVideo,
    };
  }

  return null;
}

async function run() {
  try {
    const conn = getConn();

    if (!conn) {
      throw new Error("missing_db_env");
    }

    const sql = neon(conn);

    const rows = await sql`
      select *
      from jobs
      where lower(app) = 'photofx'
        andlower(coalesce(status::text, '')) = 'queued'
      order by updated_at asc, created_at asc
      limit 1
    `;

    const job = rows[0] || null;

    if (!job) {
      console.log("[WORKER] queued photofx job yok");
      return;
    }

    const outputs = Array.isArray(job.outputs) ? job.outputs : [];
    const meta = job.meta || {};
    const effectMeta = resolveEffectMeta(meta);

    const sourceOutput = pickBestSourceOutput(outputs);

    const sourceFromMeta =
      String(meta?.logo_overlay_url || "").trim() ||
      String(meta?.muxed_url || "").trim() ||
      String(meta?.preview_video_url || "").trim() ||
      String(meta?.final_video_url || "").trim();

    const sourceUrl = sourceOutput?.url || sourceFromMeta || "";
    const sourceVariant =
      sourceOutput?.variant ||
      (meta?.logo_overlay_url
        ? "logo_overlay"
        : meta?.muxed_url
        ? "mux"
        : meta?.preview_video_url
        ? "preview"
        : meta?.final_video_url
        ? "finalized"
        : "provider");

    if (!sourceUrl) {
      throw new Error(`photofx_source_missing:${job.id}`);
    }

    await sql`
      update jobs
      set
        status = 'processing',
        meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify({
          worker: {
            stage: "photofx_effects",
            claimed_at: new Date().toISOString(),
            source_variant: sourceVariant,
            source_url: sourceUrl,
          },
          effects_queue: {
            status: "processing",
            processing_at: new Date().toISOString(),
          },
        })}::jsonb,
        updated_at = now()
      where id = ${job.id}::uuid
    `;

    console.log("[WORKER] claimed photofx job", {
      job_id: job.id,
      source_variant: sourceVariant,
      source_url: sourceUrl,
      preset: effectMeta.preset || "",
      styles: effectMeta.styles || [],
      overlayPaths: effectMeta.overlayPaths || [],
      lutPaths: effectMeta.lutPaths || [],
    });
  } catch (err) {
    console.error("[WORKER] hata:", err?.message || err);
  }
}

run();
