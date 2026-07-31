// api/ad-film/seedance/finalize.js
export { config, maxDuration } from "./finalize-v2.js";

import finalizeV2 from "./finalize-v2.js";
import finalizeNativeScene from "./finalize-native-scene.js";
import { getOwnedProject, resolveAdFilmUser } from "../../_lib/ad-film-projects.js";

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
      if (
        project?.avatar?.enabled === true &&
        pipeline?.compositeMode === "native-scene"
      ) {
        return finalizeNativeScene(req, res);
      }
    }
  } catch (_) {}
  return finalizeV2(req, res);
}
