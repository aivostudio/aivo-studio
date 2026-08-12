// api/ad-film/seedance/finalize.js
export { config, maxDuration } from "./finalize-v2.js";

import finalizeV2 from "./finalize-v2.js";
import { prepareFinalizerLogoAsset } from "../../_lib/ad-film-logo-original-quality.js";
import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function getOrigin(req) {
  const proto = clean(req.headers?.["x-forwarded-proto"], 40).split(",")[0] || "https";
  const host =
    clean(req.headers?.["x-forwarded-host"], 240).split(",")[0] ||
    clean(req.headers?.host, 240);
  return host ? `${proto}://${host}` : "https://aivo.tr";
}

async function ensureAutoMusicReady(req, project) {
  const mode = clean(project?.music?.mode || "auto", 40).toLowerCase();
  if (mode === "off" || mode === "upload") return { ready: true, project };
  if (clean(project?.music?.audio?.url, 4000)) return { ready: true, project };

  const generation = project?.musicGeneration || {};
  if (!clean(generation.requestId, 240)) {
    return { ready: false, failed: true, error: "music_audio_required" };
  }

  const cookie = clean(req.headers?.cookie, 8000);
  const response = await fetch(
    `${getOrigin(req)}/api/ad-film/music/status?projectId=${encodeURIComponent(project.id)}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(cookie ? { cookie } : {}),
        "x-aivo-internal-source": "adfilm-finalize-music-check",
      },
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => null);
  const status = clean(data?.status, 40).toUpperCase();

  if (response.ok && status === "COMPLETED" && clean(data?.project?.music?.audio?.url, 4000)) {
    return { ready: true, project: data.project };
  }

  if (status === "FAILED") {
    return {
      ready: false,
      failed: true,
      error: clean(data?.error || data?.message || "music_generation_failed", 900),
    };
  }

  if (!response.ok && response.status >= 400 && response.status < 500 && response.status !== 409 && response.status !== 425 && response.status !== 429) {
    return {
      ready: false,
      failed: true,
      error: clean(data?.error || data?.message || `music_status_http_${response.status}`, 900),
    };
  }

  return { ready: false, processing: true };
}

async function prepareLogo(user, project) {
  const logo = project?.media?.logo;
  if (!logo) return project;

  const generation = project?.generation || {};
  const prepared = await prepareFinalizerLogoAsset({
    user,
    projectId: project.id,
    item: logo,
    resolution: clean(generation?.input?.resolution || project?.output?.quality || "480p", 20).toLowerCase(),
    aspectRatio: clean(generation?.input?.aspectRatio || project?.output?.aspectRatio || "16:9", 20),
    nativeMode: false,
  });

  if (
    prepared?.key === logo?.key &&
    prepared?.finalizerLogoPreset === logo?.finalizerLogoPreset
  ) {
    return project;
  }

  return saveProject(user, {
    ...project,
    media: {
      ...(project.media || {}),
      logo: prepared,
    },
  });
}

export default async function handler(req, res) {
  try {
    const user = await resolveAdFilmUser(req);
    const projectId = clean(req.body?.projectId || req.query?.projectId, 120);
    if (user && projectId) {
      let project = await getOwnedProject(user, projectId);

      if (project) {
        try {
          const music = await ensureAutoMusicReady(req, project);
          if (!music.ready) {
            return sendJson(res, music.failed ? 409 : 425, {
              ok: false,
              error: music.failed ? "music_generation_failed" : "music_audio_processing",
              message: music.error || "Reklam müziği hazırlanıyor.",
              retryable: !music.failed,
            });
          }
          project = music.project || project;
        } catch (error) {
          console.error("[ad-film/seedance/finalize/music-check]", error);
          return sendJson(res, 425, {
            ok: false,
            error: "music_audio_processing",
            message: clean(error?.message || error, 1200),
            retryable: true,
          });
        }
      }

      if (project?.media?.logo) {
        try {
          await prepareLogo(user, project);
        } catch (error) {
          console.error("[ad-film/seedance/finalize/logo-prepare]", error);
          return sendJson(res, 500, {
            ok: false,
            error: "logo_prepare_failed",
            message: clean(error?.message || error, 1200),
            retryable: false,
          });
        }
      }
    }
  } catch (error) {
    console.error("[ad-film/seedance/finalize/router]", error);
  }

  return finalizeV2(req, res);
}
