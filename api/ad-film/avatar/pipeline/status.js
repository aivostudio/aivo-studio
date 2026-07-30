// api/ad-film/avatar/pipeline/status.js
export const config = { runtime: "nodejs" };
export const maxDuration = 120;

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../../_lib/ad-film-projects.js";

const KLING_PRO_I2V = "fal-ai/kling-video/v3/pro/image-to-video";
const KLING_STANDARD_I2V = "fal-ai/kling-video/v3/standard/image-to-video";
const KLING_MOTION = "fal-ai/kling-video/v3/pro/motion-control";
const WAN_MOTION = "fal-ai/wan-motion";
const LIPSYNC = "fal-ai/sync-lipsync/v3";

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
function videoUrlFrom(payload) {
  const value = pick(payload, ["video.url","data.video.url","result.video.url","output.video.url","response.video.url","video_url"]);
  return typeof value === "string" && /^https:\/\//i.test(value) ? value : null;
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
async function falFetch(url) {
  const response = await fetch(url, { method:"GET", headers:{ Authorization:`Key ${falKey()}`, Accept:"application/json" } });
  return { response, data:parseJson(await response.text().catch(() => "")) };
}
async function readJob(job) {
  const statusUrl = clean(job?.statusUrl, 1600) || `https://queue.fal.run/${job.model}/requests/${encodeURIComponent(job.requestId)}/status`;
  const responseUrl = clean(job?.responseUrl, 1600) || `https://queue.fal.run/${job.model}/requests/${encodeURIComponent(job.requestId)}`;
  const statusResponse = await falFetch(statusUrl);
  if (!statusResponse.response.ok) {
    if (statusResponse.response.status === 404) return { status:"FAILED", error:"fal_status_not_found", statusUrl, responseUrl };
    const error = new Error("fal_status_error"); error.status = statusResponse.response.status; error.data = statusResponse.data; throw error;
  }
  const raw = pick(statusResponse.data, ["status","state","data.status","result.status"]);
  let videoUrl = videoUrlFrom(statusResponse.data);
  let status = normalizeStatus(raw, videoUrl);
  if (!videoUrl && status === "COMPLETED") {
    const resultResponse = await falFetch(responseUrl);
    if (resultResponse.response.ok) videoUrl = videoUrlFrom(resultResponse.data);
    else if (resultResponse.response.status !== 202) return { status:"FAILED", error:clean(pick(resultResponse.data,["error","message","detail"]),1200)||"fal_result_error", statusUrl, responseUrl };
    status = normalizeStatus(raw, videoUrl);
  }
  return { status, videoUrl, statusUrl, responseUrl, error:status === "FAILED" ? clean(pick(statusResponse.data,["error","message","detail"]),1200)||"fal_generation_failed" : null };
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
function i2vInput(pipeline) {
  return {
    start_image_url:pipeline.stageImageUrl,
    prompt:pipeline.prompt,
    duration:String(pipeline.duration),
    generate_audio:false,
    negative_prompt:"identity drift, distorted face, extra people, duplicate limbs, warped hands, text, logo, watermark, abrupt camera shake, low quality",
  };
}
async function queueMotionFallback(pipeline) {
  const current = pipeline.motion || {};
  const driver = clean(pipeline.driverVideoUrl, 4000);
  const level = Number(current.fallbackLevel || 0);

  if (current.model === KLING_MOTION && driver && level < 1) {
    const job = await submitQueue(WAN_MOTION, {
      video_url:driver,
      image_url:pipeline.stageImageUrl,
      prompt:pipeline.prompt,
      adapt_motion:true,
      enhance_identity:true,
      acceleration:"regular",
    });
    return { ...job, provider:"fal", inputMode:"wan-motion", fallbackLevel:1 };
  }
  if (current.model !== KLING_STANDARD_I2V && level < 2) {
    const job = await submitQueue(KLING_STANDARD_I2V, i2vInput(pipeline));
    return { ...job, provider:"fal", inputMode:"image-to-video-standard", fallbackLevel:2 };
  }
  return null;
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
    if (pipeline.status === "completed" && pipeline.videoUrl) return sendJson(res,200,{ok:true,status:"COMPLETED",video_url:pipeline.videoUrl,pipeline,project});
    if (pipeline.status === "failed") return sendJson(res,200,{ok:true,status:"FAILED",pipeline,project});
    if (!falKey()) return sendJson(res,500,{ok:false,error:"missing_fal_key"});

    const now = new Date().toISOString();
    if (pipeline.stage === "motion") {
      const result = await readJob(pipeline.motion);
      if (result.status === "FAILED") {
        const fallback = await queueMotionFallback(pipeline);
        if (!fallback) {
          pipeline = { ...pipeline,status:"failed",updatedAt:now,error:result.error||"avatar_motion_failed",motion:{...pipeline.motion,error:result.error||"avatar_motion_failed"} };
        } else {
          pipeline = { ...pipeline,status:"motion_queued",updatedAt:now,error:null,motion:fallback };
        }
      } else if (result.status === "COMPLETED" && result.videoUrl) {
        if (!pipeline.lipsyncAudioUrl) {
          pipeline = { ...pipeline,status:"completed",stage:"completed",updatedAt:now,completedAt:now,videoUrl:result.videoUrl,motion:{...pipeline.motion,videoUrl:result.videoUrl,error:null} };
        } else {
          const lipsync = await startLipsync(pipeline,result.videoUrl);
          pipeline = { ...pipeline,status:"lipsync_queued",stage:"lipsync",updatedAt:now,motion:{...pipeline.motion,videoUrl:result.videoUrl,error:null},lipsync };
        }
      } else {
        pipeline = { ...pipeline,status:result.status === "IN_QUEUE" ? "motion_queued" : "motion_processing",updatedAt:now,motion:{...pipeline.motion,statusUrl:result.statusUrl,responseUrl:result.responseUrl,error:null} };
      }
    } else if (pipeline.stage === "lipsync") {
      const result = await readJob(pipeline.lipsync);
      if (result.status === "FAILED") {
        pipeline = { ...pipeline,status:"failed",updatedAt:now,error:result.error||"avatar_lipsync_failed",lipsync:{...pipeline.lipsync,error:result.error||"avatar_lipsync_failed"} };
      } else if (result.status === "COMPLETED" && result.videoUrl) {
        pipeline = { ...pipeline,status:"completed",stage:"completed",updatedAt:now,completedAt:now,videoUrl:result.videoUrl,lipsync:{...pipeline.lipsync,videoUrl:result.videoUrl,error:null} };
      } else {
        pipeline = { ...pipeline,status:result.status === "IN_QUEUE" ? "lipsync_queued" : "lipsync_processing",updatedAt:now,lipsync:{...pipeline.lipsync,statusUrl:result.statusUrl,responseUrl:result.responseUrl,error:null} };
      }
    }

    const nextProject = await saveProject(user,{...project,avatar:{...avatar,pipeline,videoUrl:pipeline.videoUrl||avatar.videoUrl||null}});
    const publicStatus = pipeline.status === "completed" ? "COMPLETED" : pipeline.status === "failed" ? "FAILED" : pipeline.status.includes("queued") ? "IN_QUEUE" : "RUNNING";
    return sendJson(res,200,{ok:true,projectId,status:publicStatus,stage:pipeline.stage,video_url:pipeline.videoUrl||null,pipeline,project:nextProject});
  } catch(error) {
    console.error("[ad-film/avatar/pipeline/status]",error);
    return sendJson(res,Number(error?.status)||500,{ok:false,error:clean(error?.message||error,300),fal_response:error?.data||null});
  }
}
