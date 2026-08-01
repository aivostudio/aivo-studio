// api/ad-film/seedance/finalize.js
export { config, maxDuration } from "./finalize-v2.js";

import finalizeV2 from "./finalize-v2.js";
import finalizeNativeScene from "./finalize-native-scene.js";
import { getOwnedProject, resolveAdFilmUser, sendJson } from "../../_lib/ad-film-projects.js";

function clean(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

export default async function handler(req, res) {
  try {
    const user = await resolveAdFilmUser(req);
    const projectId = clean(req.body?.projectId, 120);
    if (user && projectId) {
      const project = await getOwnedProject(user, projectId);
      const pipeline = project?.avatar?.pipeline;
      const mode = clean(pipeline?.compositeMode, 80);
      if (
        project?.avatar?.enabled === true &&
        ["native-scene", "hybrid-timeline"].includes(mode)
      ) {
        const seedanceReady = Boolean(project?.generation?.videoUrl || project?.generation?.sourceVideoUrl);
        const avatarReady = pipeline?.status === "completed" && Boolean(pipeline?.videoUrl);
        if (!seedanceReady || !avatarReady) {
          return sendJson(res, 425, {
            ok:false,
            error:!seedanceReady ? "seedance_video_processing" : "avatar_video_processing",
            seedance_ready:seedanceReady,
            avatar_ready:avatarReady,
            avatar_status:pipeline?.stage || pipeline?.status || "motion",
          });
        }
        return finalizeNativeScene(req, res);
      }
    }
  } catch (_) {}
  return finalizeV2(req, res);
}
