// api/ad-film/projects.js
import {
  getOwnedProject,
  listProjects,
  resolveAdFilmUser,
  sendJson,
} from "../_lib/ad-film-projects.js";

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function compactSummary(summary) {
  if (!summary || typeof summary !== "object") return null;
  return {
    id: clean(summary.id || summary.projectId),
    projectId: clean(summary.projectId || summary.id),
    title: clean(summary.title),
    name: clean(summary.name),
  };
}

function compactOutput(output) {
  if (!output || typeof output !== "object") return null;

  const videoUrl = clean(output.videoUrl || output.video_url || output.url);
  if (!videoUrl) return null;

  return {
    id: clean(output.id),
    version: output.version ?? null,
    videoUrl,
    previewUrl: clean(output.previewUrl || output.preview_url),
    posterUrl: clean(output.posterUrl || output.poster_url),
    duration: output.duration ?? null,
    aspectRatio: clean(output.aspectRatio || output.aspect_ratio),
    resolution: clean(output.resolution || output.quality),
    completedAt: clean(output.completedAt),
    finalizedAt: clean(output.finalizedAt),
    createdAt: clean(output.createdAt),
  };
}

function compactProject(project) {
  if (!project || typeof project !== "object") return null;

  const outputs = Array.isArray(project.outputs)
    ? project.outputs.map(compactOutput).filter(Boolean)
    : [];

  const generation = project.generation && typeof project.generation === "object"
    ? project.generation
    : null;

  const generationVideoUrl = clean(generation?.videoUrl);

  return {
    id: clean(project.id),
    outputs,
    generation: generationVideoUrl
      ? {
          outputId: clean(generation.outputId),
          requestId: clean(generation.requestId),
          version: generation.version ?? null,
          videoUrl: generationVideoUrl,
          previewUrl: clean(generation.previewUrl || generation.preview_url),
          posterUrl: clean(generation.posterUrl),
          completedAt: clean(generation.completedAt),
          input: {
            duration: generation.input?.duration ?? null,
            aspectRatio: clean(generation.input?.aspectRatio),
            resolution: clean(generation.input?.resolution),
          },
        }
      : null,
    output: {
      duration: project.output?.duration ?? null,
      quality: clean(project.output?.quality),
    },
    updatedAt: clean(project.updatedAt),
    createdAt: clean(project.createdAt),
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projects = await listProjects(user);
    const compact = clean(req.query?.compact) === "1";
    const projectSlice = projects.slice(0, 20);

    const hydratedProjects = await Promise.all(
      projectSlice.map(async (summary) => {
        const projectId = clean(summary?.id);
        if (!projectId) return null;
        return await getOwnedProject(user, projectId).catch(() => null);
      })
    );

    if (compact) {
      return sendJson(res, 200, {
        ok: true,
        compact: true,
        projects: projectSlice.map(compactSummary).filter(Boolean),
        hydratedProjects: hydratedProjects.map(compactProject).filter(Boolean),
      });
    }

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
