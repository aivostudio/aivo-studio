// api/ad-film/seedance/finalize.js
export { config, maxDuration } from "./finalize-v2.js";

import finalizeV2 from "./finalize-v2.js";
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
      const project = await getOwnedProject(user, projectId);
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
