// api/ad-film/avatar/pipeline/status-native.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../../_lib/ad-film-projects.js";

const KLING_STANDARD_I2V = "fal-ai/kling-video/v3/standard/image-to-video";
const LIPSYNC = "fal-ai/sync-lipsync/v3";
const FRESH_JOB_404_GRACE_MS = 90 * 1000;
const MOTION_QUEUE_FALLBACK_MS = 8 * 60 * 1000;

function clean(value, max = 4000) { return String(value ?? "").trim().slice(0, max); }
function falKey() { return process.env.FAL_KEY || process.env.FAL_API_KEY || ""; }
function parseJson(text) { try { return text ? JSON.parse(text) : {}; } catch (_) { return { raw:text || "" }; } }
function pick(object, paths) {
  for (const path of paths) {
    let current = object, valid = true;
    for (const key of path.split(".")) {
      if (!current || typeof current !== "object" || !(key in current)) { valid = false; break; }
      current = current[key];
    }
    if (valid && current != null) return current;
  }
  return null;
}
function providerError(payload, fallback = "fal_generation_failed") {
  const value = pick(payload, ["error","message","detail","data.error","data.message","data.detail","result.error","result.message"]);
  if (typeof value === "string" && value.trim()) return clean(value, 1200);
  try {
    const serialized = JSON.stringify(value || payload || {});
    if (serialized && serialized !== "{}") return clean(serialized, 1200);
  } catch (_) {}
  return fallback;
}
function videoUrlFrom(payload) {
  const direct = pick(payload, ["video.url","data.video.url","result.video.url","output.video.url","response.video.url","video_url"]);
  if (typeof direct === "string" && /^https:\/\//i.test(direct)) return direct;
  const list = pick(payload, ["video","data.video","result.video","output.video","response.video"]);
  if (Array.isArray(list)) {
    const item = list.find((entry) => entry && typeof entry.url === "string" && /^https:\/\//i.test(entry.url));
    if (item) return item.url;
  }
  return null;
}
function normalizeStatus(value, videoUrl) {
  if (videoUrl) return "COMPLETED";
  const status = clean(value, 80).toUpperCase();
  if (["COMPLETED","COMPLETE","SUCCEEDED","READY","DONE"].includes(status)) return "COMPLETED";
  if (["IN_PROGRESS","PROCESSING","RUNNING","STARTED"].includes(status)) return "RUNNING";
  if (["IN_QUEUE","QUEUED","PENDING"].includes(status)) return "IN_QUEUE";
  if (["FAILED","ERROR","CANCELED","CANCELLED"].includes(status)) return "FAILED";
  return "UNKNOWN";
}
function freshJob(job) {
  const submittedAt = Date.parse(job?.submittedAt || "");
  return Number.isFinite(submittedAt) && Date.now() - submittedAt < FRESH_JOB_404_GRACE_MS;
}
function jobAgeMs(job) {
  const submittedAt = Date.parse(job?.submittedAt || "");
  return Number.isFinite(submittedAt) ? Math.max(0, Date.now() - submittedAt) : 0;
}
function motionQueueExpired(pipeline, result) {
  if (pipeline?.directTalkingAvatar === true) return false;
  const motion = pipeline?.motion || {};
  return result?.status === "IN_QUEUE" && motion.model !== KLING_STANDARD_I2V && jobAgeMs(motion) >= MOTION_QUEUE_FALLBACK_MS;
}
function normalizedDuration(value) {
  const duration = Number.parseInt(value, 10);
  return [5,10,15].includes(duration) ? duration : null;
}
function normalizedRatio(value) {
  const ratio = clean(value, 20);
  return ratio === "4:5" ? "3:4" : ratio;
}
function pipelineLockError(project, pipeline) {
  const generation = project?.generation || {};
  const input = generation.input || {};
  const acceptedDuration = normalizedDuration(input.duration || project?.productionPlan?.duration);
  const pipelineDuration = normalizedDuration(pipeline?.duration);
  if (acceptedDuration && pipelineDuration && acceptedDuration !== pipelineDuration) return "production_duration_mismatch";

  const acceptedRatio = normalizedRatio(input.aspectRatio || input.aspect_ratio || project?.productionPlan?.aspectRatio);
  const pipelineRatio = normalizedRatio(pipeline?.aspectRatio);
  if (acceptedRatio && pipelineRatio && acceptedRatio !== pipelineRatio) return "production_aspect_ratio_mismatch";

  const acceptedQuality = clean(input.resolution || project?.productionPlan?.quality, 20).toLowerCase();
  const pipelineQuality = clean(pipeline?.quality, 20).toLowerCase();
  if (acceptedQuality && pipelineQuality && acceptedQuality !== pipelineQuality) return "production_quality_mismatch";

  const generationProductionId = clean(generation.productionId || input.productionId, 160);
  const pipelineProductionId = clean(pipeline?.productionId, 160);
  if (generationProductionId && pipelineProductionId && generationProductionId !== pipelineProductionId) return "production_lock_mismatch";
  return null;
}
function recoverableLocalTimeout(pipeline, generation) {
  const reason = clean(pipeline?.error || generation?.error, 1200);
  return reason === "avatar_provider_timeout" && Boolean(pipeline?.motion?.requestId || pipeline?.lipsync?.requestId);
}
function reviveTimedOutPipeline(pipeline, now) {
  const stage = pipeline?.lipsync?.requestId ? "lipsync" : "motion";
  return {
    ...(pipeline || {}),
    status: stage === "lipsync" ? "lipsync_processing" : "motion_processing",
    stage,
    error:null,
    completedAt:null,
    updatedAt:now,
    timeoutRecoveredAt:now,
    timeoutRecoveryCount:Number(pipeline?.timeoutRecoveryCount || 0) + 1,
  };
}
function failedGeneration(project, error, now) {
  return {
    ...(project?.generation || {}),
    status:"failed",
    updatedAt:now,
    completedAt:now,
    avatarWaiting:false,
    awaitingFinalComposite:false,
    finalizing:false,
    error:clean(error,1200) || "avatar_pipeline_failed",
  };
}
function activeGeneration(project, pipeline, now) {
  return {
    ...(project?.generation || {}),
    status:"processing",
    updatedAt:now,
    completedAt:null,
    avatarWaiting:true,
    awaitingFinalComposite:true,
    finalizing:false,
    sourceOnly:true,
    activeAvatarRequestId:clean(pipeline?.motion?.requestId || pipeline?.lipsync?.requestId, 240) || null,
    error:null,
  };
}
function avatarReadyGeneration(project, pipeline, now) {
  return {
    ...(project?.generation || {}),
    status:"processing",
    updatedAt:now,
    completedAt:null,
    avatarWaiting:false,
    awaitingFinalComposite:true,
    finalizing:true,
    sourceOnly:true,
    avatarVideoUrl:clean(pipeline?.videoUrl, 4000) || null,
    activeAvatarRequestId:null,
    error:null,
  };
}
function isFinalOutput(item) {
  return Boolean(item && clean(item.videoUrl, 4000) && (
    Number(item.mixVersion || 0) >= 4 ||
    item.finalizedAt ||
    item.avatarApplied === true ||
    item.avatarIntegrated === true ||
    item.hybridTimeline === true ||
    clean(item.avatarCompositeMode, 80)
  ));
}
function matchingFinalOutput(project, pipeline) {
  const generation = project?.generation || {};
  const acceptedProductionId = clean(
    generation.productionId || generation.input?.productionId || project?.productionPlan?.productionId,
    160,
  );
  const pipelineProductionId = clean(pipeline?.productionId, 160);
  if (acceptedProductionId && pipelineProductionId && acceptedProductionId !== pipelineProductionId) return null;

  const ids = new Set(
    [project?.activeOutputId, generation.outputId, generation.requestId]
      .map((value) => clean(value, 240))
      .filter(Boolean),
  );
  if (!ids.size) return null;
  const outputs = Array.isArray(project?.outputs) ? project.outputs : [];
  return outputs.find((item) => ids.has(clean(item?.id, 240)) && isFinalOutput(item)) || null;
}
function completedGeneration(project, pipeline, output, now) {
  const generation = project?.generation || {};
  const completedAt = clean(output?.completedAt || output?.finalizedAt || generation.completedAt, 80) || now;
  return {
    ...generation,
    status:"completed",
    outputId:clean(output?.id, 240) || generation.outputId || generation.requestId || null,
    sourceVideoUrl:clean(output?.sourceVideoUrl || generation.sourceVideoUrl, 4000) || null,
    videoUrl:clean(output?.videoUrl, 4000) || generation.videoUrl || null,
    logoUrl:clean(output?.logoUrl || generation.logoUrl, 4000) || null,
    logoApplied:output?.logoApplied === true || generation.logoApplied === true,
    narrationUrl:clean(output?.narrationUrl || generation.narrationUrl, 4000) || null,
    narrationApplied:output?.narrationApplied === true || generation.narrationApplied === true,
    musicUrl:clean(output?.musicUrl || generation.musicUrl, 4000) || null,
    musicApplied:output?.musicApplied === true || generation.musicApplied === true,
    avatarUrl:clean(output?.avatarVideoUrl || output?.avatarUrl || pipeline?.videoUrl || generation.avatarUrl, 4000) || null,
    avatarApplied:output?.avatarApplied === true || output?.avatarIntegrated === true || generation.avatarApplied === true,
    mixVersion:Number(output?.mixVersion || generation.mixVersion || 0),
    updatedAt:now,
    completedAt,
    avatarWaiting:false,
    awaitingFinalComposite:false,
    finalizing:false,
    sourceOnly:false,
    activeAvatarRequestId:null,
    error:null,
    finalization:{
      ...(generation.finalization || {}),
      status:"completed",
      outputId:clean(output?.id, 240) || generation.outputId || generation.requestId || null,
      completedAt,
      error:null,
    },
  };
}
async function healCompletedProject(user, project, pipeline, output, now) {
  const generation = project?.generation || {};
  const alreadyCanonical = clean(project?.status, 40).toLowerCase() === "completed" &&
    clean(generation.status, 40).toLowerCase() === "completed" &&
    clean(generation.videoUrl, 4000) === clean(output?.videoUrl, 4000) &&
    generation.avatarWaiting !== true && generation.awaitingFinalComposite !== true &&
    generation.finalizing !== true && generation.sourceOnly !== true &&
    project?.preparingNewVersion !== true;
  if (alreadyCanonical) return project;

  return saveProject(user, {
    ...project,
    status:"completed",
    preparingNewVersion:false,
    activeOutputId:clean(output?.id, 240) || project?.activeOutputId || null,
    generation:completedGeneration(project, pipeline, output, now),
    avatar:{
      ...(project?.avatar || {}),
      pipeline:{...(pipeline || {}),status:"completed",stage:"completed",error:null},
      videoUrl:clean(pipeline?.videoUrl, 4000) || project?.avatar?.videoUrl || null,
    },
    error:null,
    lastError:null,
  });
}
async function completedResponse(res, user, projectId, project, pipeline, output, now) {
  const nextProject = await healCompletedProject(user, project, pipeline, output, now);
  return sendJson(res,200,{
    ok:true,
    projectId,
    status:"COMPLETED",
    stage:"completed",
    video_url:clean(output?.videoUrl,4000) || null,
    avatar_video_url:clean(pipeline?.videoUrl,4000) || null,
    error:null,
    pipeline:nextProject?.avatar?.pipeline || pipeline,
    project:nextProject,
  });
}
async function saveTerminalProject(user, project, avatar, pipeline, error, now) {
  const reason = clean(error || pipeline?.error, 1200) || "avatar_pipeline_failed";
  const terminalPipeline = {
    ...(pipeline || {}),
    status:"failed",
    stage:"failed",
    updatedAt:now,
    completedAt:now,
    error:reason,
  };
  return saveProject(user, {
    ...project,
    status:"failed",
    generation:failedGeneration(project, reason, now),
    avatar:{...avatar,pipeline:terminalPipeline,videoUrl:null},
  });
}
async function falFetch(url) {
  const response = await fetch(url, { method:"GET", headers:{ Authorization:`Key ${falKey()}`, Accept:"application/json" } });
  return { response, data:parseJson(await response.text().catch(() => "")) };
}
async function readJob(job) {
  if (!job?.model || !job?.requestId) return { status:"FAILED", error:"fal_job_missing" };
  const statusUrl = clean(job?.statusUrl, 1600) || `https://queue.fal.run/${job.model}/requests/${encodeURIComponent(job.requestId)}/status`;
  const responseUrl = clean(job?.responseUrl, 1600) || `https://queue.fal.run/${job.model}/requests/${encodeURIComponent(job.requestId)}`;
  const statusResponse = await falFetch(statusUrl);
  if (!statusResponse.response.ok) {
    if (statusResponse.response.status === 404 && freshJob(job)) return { status:"IN_QUEUE", error:null, statusUrl, responseUrl, transient:true };
    return { status:"FAILED", error:providerError(statusResponse.data, `fal_status_error:${statusResponse.response.status}`), statusUrl, responseUrl };
  }
  const raw = pick(statusResponse.data, ["status","state","data.status","result.status"]);
  let videoUrl = videoUrlFrom(statusResponse.data);
  let status = normalizeStatus(raw, videoUrl);
  if (!videoUrl && status === "COMPLETED") {
    const resultResponse = await falFetch(responseUrl);
    if (resultResponse.response.ok) videoUrl = videoUrlFrom(resultResponse.data);
    else if (resultResponse.response.status === 202 || (resultResponse.response.status === 404 && freshJob(job))) return { status:"RUNNING", videoUrl:null, statusUrl, responseUrl, error:null, transient:true };
    else return { status:"FAILED", error:providerError(resultResponse.data, "fal_result_error"), statusUrl, responseUrl };
    status = normalizeStatus(raw, videoUrl);
  }
  return { status, videoUrl, statusUrl, responseUrl, error:status === "FAILED" ? providerError(statusResponse.data) : null };
}
async function submitQueue(model, input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`https://queue.fal.run/${model}`, {
      method:"POST",
      headers:{ Authorization:`Key ${falKey()}`, "Content-Type":"application/json", Accept:"application/json" },
      body:JSON.stringify(input),
      signal:controller.signal,
    });
    const data = parseJson(await response.text().catch(() => ""));
    if (!response.ok) { const error = new Error("fal_submit_failed"); error.status=response.status; error.data=data; throw error; }
    const requestId = clean(data?.request_id || data?.requestId || data?.id, 240);
    if (!requestId) throw new Error("fal_missing_request_id");
    return {
      model,
      requestId,
      statusUrl:clean(data?.status_url || data?.statusUrl || data?.urls?.status,1600) || `https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}/status`,
      responseUrl:clean(data?.response_url || data?.responseUrl || data?.urls?.response,1600) || `https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}`,
      submittedAt:new Date().toISOString(),
      videoUrl:null,
      error:null,
    };
  } finally { clearTimeout(timeout); }
}
function fallbackMotionInput(pipeline) {
  return {
    start_image_url:pipeline.stageImageUrl,
    prompt:pipeline.prompt,
    duration:String(pipeline.duration),
    generate_audio:false,
    cfg_scale:Number(pipeline.cfgScale || 0.72),
    negative_prompt:"still image, frozen frame, static pose, identity drift, distorted face, extra people, duplicate limbs, warped hands, wrong product, duplicate product, text, logo, watermark, picture-in-picture, low quality, abrupt camera shake",
  };
}
async function queueMotionFallback(pipeline) {
  const current = pipeline?.motion || {};
  if (pipeline?.directTalkingAvatar === true || current.model === KLING_STANDARD_I2V) return null;
  const job = await submitQueue(KLING_STANDARD_I2V, fallbackMotionInput(pipeline));
  return {
    ...job,
    provider:"fal",
    inputMode:"native-scene-standard-fallback",
    fallbackLevel:Number(current.fallbackLevel || 0) + 1,
    fallbackFrom:current.model || null,
    fallbackReason:"provider_queue_timeout",
  };
}
async function startLipsync(pipeline, motionVideoUrl) {
  if (!pipeline.lipsyncAudioUrl) return null;
  const job = await submitQueue(LIPSYNC, {
    video_url:motionVideoUrl,
    audio_url:pipeline.lipsyncAudioUrl,
    sync_mode:"silence",
    options:{ sync_mode:"silence", model_mode:"talking_head", prompt:"neutral", temperature:0.35 },
  });
  return { ...job, provider:"fal", syncMode:"silence", videoUrl:null, error:null };
}
function queuedStatus(result, queued, processing) {
  return result.status === "IN_QUEUE" ? queued : processing;
}

export default async function handler(req,res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") { res.setHeader("Allow","GET, POST"); return sendJson(res,405,{ok:false,error:"method_not_allowed"}); }
    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res,401,{ok:false,error:"unauthorized"});
    const source = req.method === "GET" ? req.query || {} : req.body || {};
    const projectId = clean(source.projectId,120);
    if (!projectId) return sendJson(res,400,{ok:false,error:"missing_project_id"});
    const project = await getOwnedProject(user,projectId);
    if (!project) return sendJson(res,404,{ok:false,error:"project_not_found"});
    const avatar = project.avatar || {};
    let pipeline = avatar.pipeline;
    if (avatar.enabled !== true) return sendJson(res,200,{ok:true,skipped:true,status:"DISABLED",project});
    if (!pipeline) return sendJson(res,200,{ok:true,status:"IDLE",project});

    const now = new Date().toISOString();
    const existingFinal = matchingFinalOutput(project,pipeline);
    if (existingFinal) return completedResponse(res,user,projectId,project,pipeline,existingFinal,now);

    if (pipeline.status === "completed" && pipeline.videoUrl) {
      // A completed avatar is only an intermediate result. Do not persist a
      // new processing state on every poll: late status requests used to race
      // the finalizer and reopen an already completed production.
      const readyProject = {
        ...project,
        status:"processing",
        generation:avatarReadyGeneration(project,pipeline,now),
        avatar:{...avatar,pipeline,videoUrl:pipeline.videoUrl},
      };
      return sendJson(res,200,{ok:true,projectId,status:"COMPLETED",stage:"completed",video_url:pipeline.videoUrl,error:null,pipeline,project:readyProject});
    }
    if (pipeline.status === "failed") {
      const reason = pipeline.error || project?.generation?.error || "avatar_pipeline_failed";
      if (recoverableLocalTimeout(pipeline, project?.generation)) {
        pipeline = reviveTimedOutPipeline(pipeline, now);
      } else {
        const alreadyTerminal = String(project.status) === "failed" && String(project?.generation?.status) === "failed";
        const nextProject = alreadyTerminal ? project : await saveTerminalProject(user,project,avatar,pipeline,reason,now);
        return sendJson(res,200,{ok:true,projectId,status:"FAILED",stage:"failed",video_url:null,error:reason,pipeline:nextProject.avatar?.pipeline||pipeline,project:nextProject});
      }
    }

    const lockError = pipelineLockError(project, pipeline);
    if (lockError) {
      const nextProject = await saveTerminalProject(user,project,avatar,pipeline,lockError,now);
      return sendJson(res,200,{ok:true,projectId,status:"FAILED",stage:"failed",video_url:null,error:lockError,pipeline:nextProject.avatar.pipeline,project:nextProject});
    }

    if (!falKey()) return sendJson(res,500,{ok:false,error:"missing_fal_key"});

    if (pipeline.stage === "motion") {
      const result = await readJob(pipeline.motion);
      if (motionQueueExpired(pipeline,result)) {
        const fallback = await queueMotionFallback(pipeline);
        if (fallback) {
          pipeline = {
            ...pipeline,
            status:"motion_queued",
            stage:"motion",
            originalStartedAt:pipeline.originalStartedAt || pipeline.startedAt,
            startedAt:now,
            updatedAt:now,
            error:null,
            motion:fallback,
          };
        } else {
          pipeline = {
            ...pipeline,
            status:queuedStatus(result,"motion_queued","motion_processing"),
            updatedAt:now,
            error:null,
            motion:{...pipeline.motion,statusUrl:result.statusUrl,responseUrl:result.responseUrl,error:null},
          };
        }
      } else if (result.status === "FAILED") {
        pipeline = { ...pipeline,status:"failed",stage:"failed",updatedAt:now,completedAt:now,error:result.error||"avatar_motion_failed",motion:{...pipeline.motion,error:result.error||"avatar_motion_failed"} };
      } else if (result.status === "COMPLETED" && result.videoUrl) {
        if (pipeline.lipsyncAudioUrl) {
          const lipsync = await startLipsync(pipeline,result.videoUrl);
          pipeline = { ...pipeline,status:"lipsync_queued",stage:"lipsync",updatedAt:now,motionVideoUrl:result.videoUrl,motion:{...pipeline.motion,videoUrl:result.videoUrl,error:null},lipsync };
        } else {
          pipeline = { ...pipeline,status:"completed",stage:"completed",updatedAt:now,completedAt:now,motionVideoUrl:result.videoUrl,videoUrl:result.videoUrl,motion:{...pipeline.motion,videoUrl:result.videoUrl,error:null},error:null };
        }
      } else {
        pipeline = { ...pipeline,status:queuedStatus(result,"motion_queued","motion_processing"),updatedAt:now,error:null,motion:{...pipeline.motion,statusUrl:result.statusUrl,responseUrl:result.responseUrl,error:null} };
      }
    } else if (pipeline.stage === "lipsync") {
      const result = await readJob(pipeline.lipsync);
      if (result.status === "FAILED") {
        pipeline = { ...pipeline,status:"failed",stage:"failed",updatedAt:now,completedAt:now,error:result.error||"avatar_lipsync_failed",lipsync:{...pipeline.lipsync,error:result.error||"avatar_lipsync_failed"} };
      } else if (result.status === "COMPLETED" && result.videoUrl) {
        pipeline = { ...pipeline,status:"completed",stage:"completed",updatedAt:now,completedAt:now,videoUrl:result.videoUrl,lipsync:{...pipeline.lipsync,videoUrl:result.videoUrl,error:null},error:null };
      } else {
        pipeline = { ...pipeline,status:queuedStatus(result,"lipsync_queued","lipsync_processing"),updatedAt:now,error:null,lipsync:{...pipeline.lipsync,statusUrl:result.statusUrl,responseUrl:result.responseUrl,error:null} };
      }
    }

    // Provider calls can overlap with final post-production. Re-read the
    // canonical project before writing so a late poll cannot overwrite a final
    // output that completed while this request was waiting on Fal.
    const latestProject = await getOwnedProject(user,projectId) || project;
    const latestPipeline = latestProject?.avatar?.pipeline || pipeline;
    const latestFinal = matchingFinalOutput(latestProject,latestPipeline);
    if (latestFinal) return completedResponse(res,user,projectId,latestProject,latestPipeline,latestFinal,now);

    if (pipeline.status === "failed") {
      const latestAvatar = latestProject.avatar || avatar;
      const nextProject = await saveTerminalProject(user,latestProject,latestAvatar,pipeline,pipeline.error||"avatar_pipeline_failed",now);
      return sendJson(res,200,{ok:true,projectId,status:"FAILED",stage:"failed",video_url:null,error:nextProject.generation?.error||pipeline.error,pipeline:nextProject.avatar.pipeline,project:nextProject});
    }

    const safeVideo = pipeline.status === "completed" ? clean(pipeline.videoUrl,4000) : "";
    const generation = safeVideo ? avatarReadyGeneration(latestProject,pipeline,now) : activeGeneration(latestProject,pipeline,now);
    const nextProject = await saveProject(user,{
      ...latestProject,
      status:"processing",
      generation,
      avatar:{...(latestProject.avatar || avatar),pipeline,videoUrl:safeVideo||null},
    });
    const publicStatus = pipeline.status === "completed" ? "COMPLETED" : pipeline.status.includes("queued") ? "IN_QUEUE" : "RUNNING";
    return sendJson(res,200,{ok:true,projectId,status:publicStatus,stage:pipeline.stage,video_url:safeVideo||null,error:null,recovered_from_timeout:Boolean(pipeline.timeoutRecoveredAt),pipeline,project:nextProject});
  } catch(error) {
    console.error("[ad-film/avatar/pipeline/status-native]",error,error?.data||"");
    return sendJson(res,Number(error?.status)||500,{ok:false,error:clean(error?.message||error,1200),detail:error?.data||null});
  }
}