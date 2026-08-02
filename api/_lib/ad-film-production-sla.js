const TIMEOUT_CODE = "production_sla_timeout";

const TOTAL_LIMITS_MS = Object.freeze({
  "480p": 15 * 60 * 1000,
  "720p": 18 * 60 * 1000,
  "1080p": 25 * 60 * 1000,
  "4k": 40 * 60 * 1000,
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
  return Object.prototype.hasOwnProperty.call(TOTAL_LIMITS_MS, value) ? value : "1080p";
}

function productionStartedAt(project) {
  return clean(
    project?.generation?.startedAt ||
    project?.avatar?.pipeline?.productionStartedAt ||
    project?.avatar?.pipeline?.originalStartedAt ||
    project?.avatar?.pipeline?.startedAt ||
    project?.finalization?.startedAt ||
    project?.updatedAt,
    80,
  );
}

function finalOutputReady(project) {
  const generation = project?.generation || {};
  if (
    clean(generation.status, 40).toLowerCase() === "completed" &&
    clean(generation.videoUrl) &&
    generation.awaitingFinalComposite !== true &&
    generation.avatarWaiting !== true &&
    generation.finalizing !== true
  ) return true;

  const activeOutputId = clean(project?.activeOutputId, 240);
  const outputs = Array.isArray(project?.outputs) ? project.outputs : [];
  return Boolean(activeOutputId && outputs.some((item) => clean(item?.id, 240) === activeOutputId && clean(item?.videoUrl)));
}

function productionSla(project, nowMs = Date.now()) {
  const resolution = resolutionOf(project);
  const limitMs = TOTAL_LIMITS_MS[resolution];
  const startedAt = productionStartedAt(project);
  const startedMs = Date.parse(startedAt || "");
  const validStart = Number.isFinite(startedMs);
  const elapsedMs = validStart ? Math.max(0, nowMs - startedMs) : 0;
  const deadlineAt = validStart ? new Date(startedMs + limitMs).toISOString() : null;
  const terminal = ["completed", "failed", "cancelled", "canceled"].includes(clean(project?.status, 40).toLowerCase());
  return {
    code: TIMEOUT_CODE,
    resolution,
    limitMs,
    startedAt: validStart ? new Date(startedMs).toISOString() : null,
    deadlineAt,
    elapsedMs,
    expired: validStart && elapsedMs >= limitMs && !finalOutputReady(project) && !terminal,
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
