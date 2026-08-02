// api/ad-film/seedance/finalize.js
export { config, maxDuration } from "./finalize-v2.js";

import finalizeV2 from "./finalize-v2.js";
import finalizeNativeScene from "./finalize-native-scene.js";
import { prepareFinalizerLogoAsset } from "../../_lib/ad-film-image-normalizer.js";
import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function pipelineVideoUrl(pipeline) {
  const direct = clean(pipeline?.videoUrl, 4000);
  if (/^https:\/\//i.test(direct)) return direct;

  const lipsync = clean(pipeline?.lipsync?.videoUrl, 4000);
  if (/^https:\/\//i.test(lipsync)) return lipsync;

  if (!pipeline?.lipsyncAudioUrl) {
    const motion = clean(
      pipeline?.motion?.videoUrl || pipeline?.motionVideoUrl,
      4000,
    );
    if (/^https:\/\//i.test(motion)) return motion;
  }
  return "";
}

function isNativeMode(project) {
  const mode = clean(project?.avatar?.pipeline?.compositeMode, 80);
  return project?.avatar?.enabled === true && ["native-scene", "hybrid-timeline"].includes(mode);
}

function finalizerProfile(project, nativeMode) {
  const pipeline = project?.avatar?.pipeline || {};
  const generation = project?.generation || {};
  return {
    resolution: clean(
      nativeMode
        ? pipeline.quality || generation?.input?.resolution || project?.output?.quality || "1080p"
        : generation?.input?.resolution || project?.output?.quality || "480p",
      20,
    ).toLowerCase(),
    aspectRatio: clean(
      nativeMode
        ? pipeline.aspectRatio || generation?.input?.aspectRatio || project?.output?.aspectRatio || "16:9"
        : generation?.input?.aspectRatio || project?.output?.aspectRatio || "16:9",
      20,
    ),
  };
}

async function prepareLogoForFinalizer(user, project, nativeMode) {
  const logo = project?.media?.logo;
  if (!logo) return project;

  const profile = finalizerProfile(project, nativeMode);
  const prepared = await prepareFinalizerLogoAsset({
    user,
    projectId: project.id,
    item: logo,
    resolution: profile.resolution,
    aspectRatio: profile.aspectRatio,
    nativeMode,
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

async function persistRecoveredAvatarVideo(user, project, pipeline, videoUrl) {
  if (!videoUrl || clean(pipeline?.videoUrl, 4000) === videoUrl) return project;
  const now = new Date().toISOString();
  return saveProject(user, {
    ...project,
    avatar: {
      ...(project.avatar || {}),
      videoUrl,
      pipeline: {
        ...(pipeline || {}),
        status: "completed",
        stage: "completed",
        videoUrl,
        updatedAt: now,
        completedAt: pipeline?.completedAt || now,
        error: null,
      },
    },
    generation: {
      ...(project.generation || {}),
      avatarVideoUrl: videoUrl,
      avatarWaiting: false,
      awaitingFinalComposite: true,
      finalizing: true,
      updatedAt: now,
      error: null,
    },
  });
}

export default async function handler(req, res) {
  try {
    const user = await resolveAdFilmUser(req);
    const projectId = clean(req.body?.projectId, 120);
    if (user && projectId) {
      let project = await getOwnedProject(user, projectId);
      if (project) {
        const nativeMode = isNativeMode(project);
        if (project?.media?.logo) {
          try {
            project = await prepareLogoForFinalizer(user, project, nativeMode);
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

        if (nativeMode) {
          let pipeline = project?.avatar?.pipeline || {};
          const recoveredAvatarUrl = pipelineVideoUrl(pipeline);
          if (recoveredAvatarUrl && clean(pipeline?.videoUrl, 4000) !== recoveredAvatarUrl) {
            project = await persistRecoveredAvatarVideo(
              user,
              project,
              pipeline,
              recoveredAvatarUrl,
            );
            pipeline = project?.avatar?.pipeline || pipeline;
          }

          const seedanceReady = Boolean(
            project?.generation?.videoUrl || project?.generation?.sourceVideoUrl,
          );
          const avatarVideoUrl = pipelineVideoUrl(pipeline);
          const avatarReady =
            pipeline?.status === "completed" && Boolean(avatarVideoUrl);

          if (!seedanceReady || !avatarReady) {
            return sendJson(res, 425, {
              ok: false,
              error: !seedanceReady
                ? "seedance_video_processing"
                : "avatar_video_processing",
              seedance_ready: seedanceReady,
              avatar_ready: avatarReady,
              avatar_status: pipeline?.stage || pipeline?.status || "motion",
              avatar_video_recoverable: Boolean(avatarVideoUrl),
            });
          }
          return finalizeNativeScene(req, res);
        }
      }
    }
  } catch (error) {
    console.error("[ad-film/seedance/finalize/router]", error);
  }
  return finalizeV2(req, res);
}
