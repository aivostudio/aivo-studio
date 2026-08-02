const TIMEOUT_CODE = "production_sla_timeout";

// Each expensive provider stage gets its own bounded window. The former
// single 15 minute 480p deadline could expire at the exact moment Seedance
// completed, before the avatar or final composite was allowed to start.
const SOURCE_LIMITS_MS = Object.freeze({
  "480p": 25 * 60 * 1000,
  "720p": 30 * 60 * 1000,
  "1080p": 40 * 60 * 1000,
  "4k": 60 * 60 * 1000,
});

const AVATAR_LIMITS_MS = Object.freeze({
  "480p": 25 * 60 * 1000,
  "720p": 25 * 60 * 1000,
  "1080p": 30 * 60 * 1000,
  "4k": 35 * 60 * 1000,
});

const FINAL_LIMITS_MS = Object.freeze({
  "480p": 15 * 60 * 1000,
  "720p": 15 * 60 * 1000,
  "1080p": 20 * 60 * 1000,
  "4k": 25 * 60 * 1000,
});

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function resolutionOf(project) {
  const value = clean(
    project?.generation?.input?.resolution ||
    project?.productionPlan?.quality ||
    project?.output?.quality ||
    "1080p",
    20,
  ).toLowerCase();
  return Object.prototype.hasOwnProperty.call(SOURCE_LIMITS_MS, value) ? value : "1080p";
}

function validDate(...values) {
  for (const value of values) {
    const text = clean(value, 80);
    if (Number.isFinite(Date.parse(text))) return text;
  }
  return "";
}

function sourceReady(project) {
  return Boolean(clean(project?.generation?.sourceVideoUrl || project?.generation?.videoUrl));
}

function pipelineStatus(project) {
  return clean(project?.avatar?.pipeline?.status, 60).toLowerCase();
}

function pipelineFinished(project) {
  return pipelineStatus(project) === "completed" && Boolean(clean(project?.avatar?.pipeline?.videoUrl));
}

function finalOutputReady(project) {
  const generation = project?.generation || {};
  const generationStatus = clean(generation.status, 40).toLowerCase();

  if (["queued", "processing", "running", "in_queue"].includes(generationStatus)) return false;
  if (
    generation.awaitingFinalComposite === true ||
    generation.avatarWaiting === true ||
    generation.finalizing === true ||
    generation.sourceOnly === true
  ) return false;

  return Boolean(generationStatus === "completed" && clean(generation.videoUrl));
}

function phasePolicy(project, resolution) {
  const generation = project?.generation || {};
  const pipeline = project?.avatar?.pipeline || {};
  const finalization = project?.finalization || generation?.finalization || {};
  const avatarRequired = project?.avatar?.enabled === true;
  const hasSource = sourceReady(project);
  const avatarDone = pipelineFinished(project);
  const needsFinal = Boolean(
    generation.awaitingFinalComposite === true ||
    generation.finalizing === true ||
    clean(finalization.status, 40).toLowerCase() === "queued" ||
    clean(finalization.status, 40).toLowerCase() === "processing" ||
    clean(finalization.status, 40).toLowerCase() === "running"
  );

  if (!hasSource) {
    return {
      phase: "seedance",
      limitMs: SOURCE_LIMITS_MS[resolution],
      startedAt: validDate(
        generation.startedAt,
        generation.createdAt,
        project?.productionPlan?.startedAt,
        project?.updatedAt,
      ),
    };
  }

  if (avatarRequired && !avatarDone) {
    return {
      phase: "avatar",
      limitMs: AVATAR_LIMITS_MS[resolution],
      startedAt: validDate(
        generation.sourceCompletedAt,
        pipeline.productionStartedAt,
        pipeline.originalStartedAt,
        pipeline.startedAt,
        generation.updatedAt,
      ),
    };
  }

  if (needsFinal || (avatarRequired && avatarDone && !finalOutputReady(project))) {
    return {
      phase: "finalization",
      limitMs: FINAL_LIMITS_MS[resolution],
      startedAt: validDate(
        finalization.startedAt,
        pipeline.completedAt,
        generation.finalizingStartedAt,
        generation.updatedAt,
      ),
    };
  }

  return {
    phase: "complete",
    limitMs: FINAL_LIMITS_MS[resolution],
    startedAt: validDate(generation.completedAt, project?.updatedAt),
  };
}

function productionSla(project, nowMs = Date.now()) {
  const resolution = resolutionOf(project);
  const phase = phasePolicy(project, resolution);
  const startedMs = Date.parse(phase.startedAt || "");
  const validStart = Number.isFinite(startedMs);
  const elapsedMs = validStart ? Math.max(0, nowMs - startedMs) : 0;
  const deadlineAt = validStart ? new Date(startedMs + phase.limitMs).toISOString() : null;
  const terminal = ["completed", "failed", "cancelled", "canceled"].includes(clean(project?.status, 40).toLowerCase());

  return {
    code: TIMEOUT_CODE,
    phase: phase.phase,
    resolution,
    limitMs: phase.limitMs,
    startedAt: validStart ? new Date(startedMs).toISOString() : null,
    deadlineAt,
    elapsedMs,
    expired: validStart && elapsedMs >= phase.limitMs && !finalOutputReady(project) && !terminal,
  };
}

function deriveCancelUrl(job) {
  const direct = clean(job?.cancelUrl || job?.cancel_url, 1600);
  if (/^https:\/\//i.test(direct)) return direct;
  const statusUrl = clean(job?.statusUrl || job?.status_url, 1600);
  if (/^https:\/\//i.test(statusUrl)) return statusUrl.replace(/\/status\/?(?:\?.*)?$/i, "/cancel");
  const model = clean(job?.model, 300);
  const requestId = clean(job?.requestId || job?.request_id, 300);
  if (!model || !requestId) return "";
  return `https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}/cancel`;
}

function collectFalJobs(project) {
  const generation = project?.generation || {};
  const pipeline = project?.avatar?.pipeline || {};
  const jobs = [
    {
      name: "seedance",
      model: generation.model || "bytedance/seedance-2.0/reference-to-video",
      requestId: generation.requestId,
      statusUrl: generation.statusUrl,
      responseUrl: generation.responseUrl,
      cancelUrl: generation.cancelUrl,
    },
    { name: "avatar_motion", ...(pipeline.motion || {}) },
    { name: "avatar_lipsync", ...(pipeline.lipsync || {}) },
    { name: "finalization", ...(project?.productionJobs?.finalization || {}) },
  ];
  const unique = new Map();
  for (const job of jobs) {
    const requestId = clean(job?.requestId || job?.request_id, 300);
    const model = clean(job?.model, 300);
    if (!requestId || !model) continue;
    const key = `${model}|${requestId}`;
    if (!unique.has(key)) unique.set(key, { ...job, requestId, model, cancelUrl: deriveCancelUrl(job) });
  }
  return [...unique.values()];
}

async function cancelFalJob(job, key) {
  const cancelUrl = deriveCancelUrl(job);
  if (!cancelUrl || !key) return { name: job?.name || null, ok: false, skipped: true, reason: "missing_cancel_target" };
  try {
    const response = await fetch(cancelUrl, {
      method: "PUT",
      headers: { Authorization: `Key ${key}`, Accept: "application/json" },
    });
    const text = await response.text().catch(() => "");
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
    const accepted = response.status === 202 || response.status === 400 || response.status === 404;
    return {
      name: job?.name || null,
      model: job?.model || null,
      requestId: job?.requestId || null,
      ok: accepted,
      httpStatus: response.status,
      providerStatus: clean(data?.status || data?.message || "", 200) || null,
    };
  } catch (error) {
    return {
      name: job?.name || null,
      model: job?.model || null,
      requestId: job?.requestId || null,
      ok: false,
      error: clean(error?.message || error, 500),
    };
  }
}

async function cancelFalJobs(project, key) {
  const jobs = collectFalJobs(project);
  return Promise.all(jobs.map((job) => cancelFalJob(job, key)));
}

function buildCancelledProject(project, policy, cancellationResults = [], now = new Date().toISOString()) {
  const generation = project?.generation || {};
  const avatar = project?.avatar || {};
  const pipeline = avatar.pipeline || null;
  const productionId = clean(generation.productionId || generation.input?.productionId || pipeline?.productionId, 200) || null;
  const refund = {
    eligible: true,
    status: "pending_credit_system",
    reason: TIMEOUT_CODE,
    productionId,
    requestedAt: project?.productionRefund?.requestedAt || now,
    amount: Number.isFinite(Number(generation.creditCost)) ? Number(generation.creditCost) : null,
  };
  const cancelledPipeline = pipeline && !["completed", "failed", "cancelled", "canceled"].includes(clean(pipeline.status, 40).toLowerCase())
    ? {
        ...pipeline,
        status: "cancelled",
        stage: "cancelled",
        error: TIMEOUT_CODE,
        cancelledAt: now,
        completedAt: now,
        updatedAt: now,
      }
    : pipeline;
  const finalization = project?.finalization && !["completed", "failed", "cancelled", "canceled"].includes(clean(project.finalization.status, 40).toLowerCase())
    ? { ...project.finalization, status: "cancelled", error: TIMEOUT_CODE, cancelledAt: now, updatedAt: now }
    : project?.finalization;

  return {
    ...project,
    status: "cancelled",
    error: TIMEOUT_CODE,
    cancelledAt: now,
    cancellation: {
      code: TIMEOUT_CODE,
      phase: policy.phase,
      reason: "maximum_production_time_exceeded",
      cancelledAt: now,
      resolution: policy.resolution,
      limitMs: policy.limitMs,
      elapsedMs: policy.elapsedMs,
      startedAt: policy.startedAt,
      deadlineAt: policy.deadlineAt,
      providerRequests: cancellationResults,
    },
    productionRefund: refund,
    billing: {
      ...(project?.billing || {}),
      refundEligible: true,
      refundStatus: "pending_credit_system",
      refundReason: TIMEOUT_CODE,
      refundProductionId: productionId,
      refundRequestedAt: project?.billing?.refundRequestedAt || now,
    },
    generation: {
      ...generation,
      status: "cancelled",
      error: TIMEOUT_CODE,
      cancelledAt: now,
      completedAt: now,
      updatedAt: now,
      avatarWaiting: false,
      awaitingFinalComposite: false,
      finalizing: false,
      sourceOnly: false,
      activeAvatarRequestId: null,
    },
    finalization,
    avatar: avatar.enabled === true
      ? { ...avatar, pipeline: cancelledPipeline, videoUrl: null }
      : avatar,
  };
}

function cancellationResponse(project, policy) {
  return {
    ok: true,
    projectId: project?.id || null,
    status: "CANCELLED",
    stage: "cancelled",
    phase: policy.phase,
    error: TIMEOUT_CODE,
    message: "Maximum production time exceeded. The production was stopped.",
    video_url: null,
    source_video_url: project?.generation?.sourceVideoUrl || null,
    refund_eligible: true,
    refund_status: "pending_credit_system",
    deadline_at: policy.deadlineAt,
    elapsed_ms: policy.elapsedMs,
    limit_ms: policy.limitMs,
    generation: project?.generation || null,
    pipeline: project?.avatar?.pipeline || null,
    project,
  };
}

export {
  TIMEOUT_CODE,
  buildCancelledProject,
  cancelFalJobs,
  cancellationResponse,
  finalOutputReady,
  productionSla,
};
