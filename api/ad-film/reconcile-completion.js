export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../_lib/ad-film-projects.js";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function validUrl(value) {
  return /^https:\/\//i.test(clean(value));
}

function normalizedRatio(value) {
  const ratio = clean(value, 20);
  return ratio === "3:4" ? "4:5" : ratio;
}

function isFinalOutput(item) {
  return Boolean(
    item &&
    validUrl(item.videoUrl) &&
    (
      Number(item.mixVersion || 0) >= 4 ||
      item.finalizedAt ||
      item.hybridTimeline === true ||
      item.avatarApplied === true ||
      item.avatarIntegrated === true ||
      clean(item.avatarCompositeMode, 80)
    )
  );
}

function outputProductionId(item) {
  return clean(
    item?.productionId || item?.production_id || item?.input?.productionId,
    160,
  );
}

function completedTime(item) {
  return Date.parse(item?.completedAt || item?.finalizedAt || item?.createdAt || "");
}

function profileMatches(item, project) {
  const generation = project?.generation || {};
  const input = generation.input || {};
  const expectedDuration = clean(
    input.duration || project?.productionPlan?.duration || project?.output?.duration,
    20,
  );
  const expectedRatio = normalizedRatio(
    input.aspectRatio || input.aspect_ratio || project?.productionPlan?.aspectRatio || project?.output?.aspectRatio,
  );
  const expectedResolution = clean(
    input.resolution || project?.productionPlan?.quality || project?.output?.quality,
    20,
  ).toLowerCase();

  const itemDuration = clean(item?.duration, 20);
  const itemRatio = normalizedRatio(item?.aspectRatio);
  const itemResolution = clean(item?.resolution, 20).toLowerCase();

  if (expectedDuration && itemDuration && expectedDuration !== itemDuration) return false;
  if (expectedRatio && itemRatio && expectedRatio !== itemRatio) return false;
  if (expectedResolution && itemResolution && expectedResolution !== itemResolution) return false;
  return true;
}

function currentFinalOutput(project) {
  const generation = project?.generation || {};
  const productionId = clean(
    generation.productionId || generation.input?.productionId || project?.productionPlan?.productionId,
    160,
  );
  const ids = new Set(
    [generation.outputId, generation.requestId]
      .map((value) => clean(value, 240))
      .filter(Boolean),
  );
  const startedAt = Date.parse(generation.startedAt || generation.createdAt || "");
  const outputs = Array.isArray(project?.outputs) ? project.outputs : [];

  return outputs
    .filter((item) => {
      if (!isFinalOutput(item) || !profileMatches(item, project)) return false;
      const itemProductionId = outputProductionId(item);
      const itemTime = completedTime(item);
      const afterStart =
        !Number.isFinite(startedAt) ||
        !Number.isFinite(itemTime) ||
        itemTime >= startedAt - 5000;
      if (!afterStart) return false;

      if (itemProductionId) {
        return Boolean(productionId && itemProductionId === productionId);
      }

      const itemId = clean(item?.id, 240);
      if (itemId && ids.has(itemId)) return true;

      // Legacy finalizers did not persist productionId. Time + exact output
      // profile is the safe fallback; it rejects an old 5-second result when
      // the current production is 15 seconds.
      return true;
    })
    .sort((a, b) => completedTime(b) - completedTime(a))[0] || null;
}

function pipelineVideoUrl(project, output) {
  return clean(
    output?.avatarVideoUrl ||
      project?.avatar?.pipeline?.videoUrl ||
      project?.avatar?.pipeline?.lipsync?.videoUrl ||
      project?.avatar?.videoUrl,
    4000,
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const source = req.method === "GET" ? req.query || {} : req.body || {};
    const projectId = clean(source.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const output = currentFinalOutput(project);
    if (!output) {
      return sendJson(res, 200, {
        ok: true,
        reconciled: false,
        status: clean(project.status, 80) || "draft",
        project,
      });
    }

    const generation = project.generation || {};
    const productionId = clean(
      generation.productionId || generation.input?.productionId || project?.productionPlan?.productionId,
      160,
    );
    const outputId = clean(output.id, 240) || clean(generation.outputId || generation.requestId, 240);
    const completedAt = clean(output.completedAt || output.finalizedAt || generation.completedAt || new Date().toISOString(), 80);
    const now = new Date().toISOString();
    const avatarVideoUrl = pipelineVideoUrl(project, output);
    const canonicalOutput = productionId && !outputProductionId(output)
      ? { ...output, productionId }
      : output;
    const outputs = (Array.isArray(project.outputs) ? project.outputs : []).map((item) =>
      clean(item?.id, 240) === clean(output.id, 240) ? canonicalOutput : item,
    );

    const alreadyCanonical =
      clean(project.status, 80).toLowerCase() === "completed" &&
      clean(generation.status, 80).toLowerCase() === "completed" &&
      clean(project.activeOutputId, 240) === outputId &&
      clean(generation.videoUrl, 4000) === clean(output.videoUrl, 4000) &&
      generation.avatarWaiting !== true &&
      generation.awaitingFinalComposite !== true &&
      generation.finalizing !== true &&
      generation.sourceOnly !== true &&
      project.preparingNewVersion !== true;

    if (alreadyCanonical) {
      return sendJson(res, 200, {
        ok: true,
        reconciled: false,
        status: "completed",
        output_id: outputId,
        video_url: output.videoUrl,
        project,
      });
    }

    const nextProject = await saveProject(user, {
      ...project,
      status: "completed",
      preparingNewVersion: false,
      activeOutputId: outputId,
      outputs,
      error: null,
      lastError: null,
      finalization: {
        ...(project.finalization || {}),
        status: "completed",
        outputId,
        productionId: productionId || null,
        completedAt,
        updatedAt: now,
        error: null,
      },
      productionJobs: {
        ...(project.productionJobs || {}),
        finalization: {
          ...(project.productionJobs?.finalization || {}),
          status: "completed",
          outputId,
          productionId: productionId || null,
          completedAt,
          updatedAt: now,
          error: null,
        },
      },
      generation: {
        ...generation,
        status: "completed",
        outputId,
        productionId: productionId || generation.productionId || null,
        videoUrl: output.videoUrl,
        sourceVideoUrl: output.sourceVideoUrl || generation.sourceVideoUrl || null,
        avatarVideoUrl: avatarVideoUrl || generation.avatarVideoUrl || null,
        logoUrl: output.logoUrl || generation.logoUrl || null,
        logoApplied: output.logoApplied === true || generation.logoApplied === true,
        narrationUrl: output.narrationUrl || generation.narrationUrl || null,
        narrationApplied: output.narrationApplied === true || generation.narrationApplied === true,
        musicUrl: output.musicUrl || generation.musicUrl || null,
        musicApplied: output.musicApplied === true || generation.musicApplied === true,
        avatarApplied: output.avatarApplied === true || output.avatarIntegrated === true || generation.avatarApplied === true,
        avatarIntegrated: output.avatarIntegrated === true || generation.avatarIntegrated === true,
        avatarCompositeMode: output.avatarCompositeMode || generation.avatarCompositeMode || null,
        mixVersion: Number(output.mixVersion || generation.mixVersion || 0),
        timeline: output.timeline || generation.timeline || project?.productionPlan?.timeline || null,
        completedAt,
        updatedAt: now,
        avatarWaiting: false,
        awaitingFinalComposite: false,
        finalizing: false,
        sourceOnly: false,
        activeAvatarRequestId: null,
        error: null,
        finalization: {
          ...(generation.finalization || {}),
          status: "completed",
          outputId,
          productionId: productionId || null,
          completedAt,
          error: null,
        },
      },
      avatar: {
        ...(project.avatar || {}),
        videoUrl: avatarVideoUrl || project?.avatar?.videoUrl || null,
        pipeline: project?.avatar?.pipeline ? {
          ...project.avatar.pipeline,
          status: "completed",
          stage: "completed",
          productionId: productionId || project.avatar.pipeline.productionId || null,
          videoUrl: avatarVideoUrl || project.avatar.pipeline.videoUrl || null,
          completedAt: project.avatar.pipeline.completedAt || completedAt,
          updatedAt: now,
          error: null,
        } : project?.avatar?.pipeline || null,
      },
    });

    return sendJson(res, 200, {
      ok: true,
      reconciled: true,
      status: "completed",
      output_id: outputId,
      video_url: output.videoUrl,
      project: nextProject,
    });
  } catch (error) {
    console.error("[ad-film/reconcile-completion]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "completion_reconcile_failed",
      message: clean(error?.message || error, 1200),
    });
  }
}
