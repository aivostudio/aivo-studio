// api/ad-film/projects.js
import {
  getOwnedProject,
  listProjects,
  resolveAdFilmUser,
  sendJson,
} from "../_lib/ad-film-projects.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projects = await listProjects(user);
    const hydratedProjects = await Promise.all(
      projects.slice(0, 20).map(async (summary) => {
        const projectId = String(summary?.id || "").trim();
        if (!projectId) return null;
        return await getOwnedProject(user, projectId).catch(() => null);
      })
    );

    return sendJson(res, 200, {
      ok: true,
      projects,
      hydratedProjects: hydratedProjects.filter(Boolean),
    });
  } catch (error) {
    console.error("[ad-film/projects]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
