// api/ad-film/seedance/result.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeOutputs(project) {
  const list = Array.isArray(project?.outputs) ? project.outputs.filter(Boolean) : [];
  if (!list.length && project?.generation?.videoUrl) {
    const generation = project.generation;
    list.push({
      id: generation.outputId || generation.requestId || `legacy-${Date.now()}`,
      requestId: generation.requestId || null,
      version: generation.version || 1,
      videoUrl: generation.videoUrl,
      logoUrl: generation.logoUrl || project?.media?.logo?.url || null,
      createdAt: generation.completedAt || generation.startedAt || project.updatedAt,
      completedAt: generation.completedAt || project.updatedAt,
      seed: generation.seed ?? null,
      duration: generation.input?.duration || project?.output?.duration || "15",
      aspectRatio: generation.input?.aspectRatio || project?.output?.aspectRatio || "9:16",
      resolution: generation.input?.resolution || project?.output?.quality || "1080p",
      generateAudio: generation.input?.generateAudio !== false,
    });
  }
  return list.slice(0, 30);
}

export default async function handler(req, res) {
  try {
    if (!["DELETE", "POST", "PATCH"].includes(req.method)) {
      res.setHeader("Allow", "DELETE, POST, PATCH");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.query?.projectId || req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const outputs = normalizeOutputs(project);
    const requestedOutputId = clean(req.query?.outputId || req.body?.outputId, 240);
    const action = clean(req.body?.action || req.query?.action, 40).toLowerCase();

    if ((req.method === "POST" || req.method === "PATCH") && action === "prepare-new-version") {
      const saved = await saveProject(user, {
        ...project,
        status: "draft",
        outputs,
        activeOutputId: null,
        preparingNewVersion: true,
        generation: null,
      });
      return sendJson(res, 200, {
        ok: true,
        projectId,
        prepared: true,
        project: saved,
        outputs: saved.outputs || [],
        activeOutputId: null,
      });
    }

    if (req.method === "POST" || req.method === "PATCH") {
      const selected = outputs.find((item) => item.id === requestedOutputId);
      if (!selected) return sendJson(res, 404, { ok: false, error: "output_not_found" });
      const saved = await saveProject(user, {
        ...project,
        status: "completed",
        outputs,
        activeOutputId: selected.id,
        preparingNewVersion: false,
        generation: project.generation?.videoUrl === selected.videoUrl
          ? project.generation
          : {
              ...project.generation,
              status: "completed",
              outputId: selected.id,
              version: selected.version,
              videoUrl: selected.videoUrl,
              logoUrl: selected.logoUrl || null,
              seed: selected.seed ?? null,
              completedAt: selected.completedAt || selected.createdAt,
              input: {
                ...(project.generation?.input || {}),
                duration: selected.duration,
                aspectRatio: selected.aspectRatio,
                resolution: selected.resolution,
                generateAudio: selected.generateAudio !== false,
              },
            },
      });
      return sendJson(res, 200, {
        ok: true,
        projectId,
        selected: selected.id,
        project: saved,
        outputs: saved.outputs || [],
        activeOutputId: saved.activeOutputId,
      });
    }

    const targetId = requestedOutputId || project.activeOutputId || outputs[0]?.id || "";
    const remaining = outputs.filter((item) => item.id !== targetId);
    const activeOutputId = remaining[0]?.id || null;
    const activeOutput = remaining[0] || null;
    const saved = await saveProject(user, {
      ...project,
      status: activeOutput ? "completed" : "draft",
      outputs: remaining,
      activeOutputId,
      preparingNewVersion: false,
      generation: activeOutput
        ? {
            ...project.generation,
            status: "completed",
            outputId: activeOutput.id,
            version: activeOutput.version,
            requestId: activeOutput.requestId || project.generation?.requestId || null,
            videoUrl: activeOutput.videoUrl,
            logoUrl: activeOutput.logoUrl || null,
            seed: activeOutput.seed ?? null,
            completedAt: activeOutput.completedAt || activeOutput.createdAt,
            input: {
              ...(project.generation?.input || {}),
              duration: activeOutput.duration,
              aspectRatio: activeOutput.aspectRatio,
              resolution: activeOutput.resolution,
              generateAudio: activeOutput.generateAudio !== false,
            },
          }
        : null,
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      removed: true,
      removedOutputId: targetId,
      project: saved,
      outputs: saved.outputs || [],
      activeOutputId: saved.activeOutputId || null,
    });
  } catch (error) {
    console.error("[ad-film/seedance/result]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
