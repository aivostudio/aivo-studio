// api/ad-film/music/create.js
export const config = { runtime: "nodejs" };

import crypto from "crypto";
import { buildAdFilmMusicPrompt } from "../../_lib/ad-film-music-prompt.js";
import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const PRIMARY_MODEL = "fal-ai/stable-audio-3/medium/text-to-audio";
const FALLBACK_MODEL = "fal-ai/stable-audio-3/small/music/text-to-audio";
const QUALITY_VERSION = 4;
const PROFILE_VERSION = 2;
const OUTPUT_FORMAT = "mp3";
const OUTPUT_BITRATE = "192k";
const NUM_INFERENCE_STEPS = 8;
const GUIDANCE_SCALE = 1;
const ENABLE_PROMPT_EXPANSION = false;
const ENABLE_SAFETY_CHECKER = true;

function clean(value, max = 1600) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function falKey(){return process.env.FAL_KEY||process.env.FAL_API_KEY||""}
function parse(text){try{return text?JSON.parse(text):{}}catch(_){return{raw:text||""}}}
function pick(data,keys){for(const key of keys){const parts=key.split(".");let cur=data,ok=true;for(const p of parts){if(!cur||typeof cur!=="object"||!(p in cur)){ok=false;break}cur=cur[p]}if(ok&&cur!=null)return cur}return null}
function errorMessage(data,status){
  const detail=pick(data,["detail.0.msg","detail","message","error","data.detail","data.message"]);
  if(typeof detail==="string"&&detail.trim())return clean(detail,900);
  if(detail&&typeof detail==="object")return clean(JSON.stringify(detail),900);
  return `Fal HTTP ${status}`;
}
function queueUrl(model){return `https://queue.fal.run/${model}`}
async function submit(key,model,payload){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetch(queueUrl(model),{method:"POST",headers:{Authorization:`Key ${key}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload),signal:controller.signal});
    const data=parse(await response.text().catch(()=>""));
    return{response,data,model};
  }finally{clearTimeout(timeout)}
}
function normalizeDuration(value){
  const requested=Number(value);
  return Number.isInteger(requested)&&requested>=5&&requested<=15?requested:null;
}
function profileSignature(prompt){
  return crypto.createHash("sha256").update(JSON.stringify({
    qualityVersion:QUALITY_VERSION,
    profileVersion:PROFILE_VERSION,
    primaryModel:PRIMARY_MODEL,
    fallbackModel:FALLBACK_MODEL,
    outputFormat:OUTPUT_FORMAT,
    outputBitrate:OUTPUT_BITRATE,
    numInferenceSteps:NUM_INFERENCE_STEPS,
    guidanceScale:GUIDANCE_SCALE,
    promptExpansion:ENABLE_PROMPT_EXPANSION,
    safetyChecker:ENABLE_SAFETY_CHECKER,
    duration:prompt.duration,
    requestedStyle:prompt.requestedStyle,
    requestedEnergy:prompt.requestedEnergy,
    resolvedStyle:prompt.resolvedStyle,
    resolvedEnergy:prompt.resolvedEnergy,
    voiceEnabled:prompt.voiceEnabled,
    prompt:prompt.prompt,
    negativePrompt:prompt.negativePrompt,
  })).digest("hex").slice(0,32);
}
function reusableAudio(audio,signature,duration){
  const url=clean(audio?.url,1600).toLowerCase().split("?")[0];
  const contentType=clean(audio?.contentType,100).toLowerCase();
  const isMp3=contentType==="audio/mpeg"||url.endsWith(".mp3");
  return !!(
    audio?.url&&
    Number(audio?.qualityVersion)>=QUALITY_VERSION&&
    Number(audio?.profileVersion)>=PROFILE_VERSION&&
    Number(audio?.duration)===Number(duration)&&
    isMp3&&
    clean(audio?.signature,80)===signature
  );
}

export default async function handler(req,res){
  try{
    if(req.method!=="POST"){res.setHeader("Allow","POST");return sendJson(res,405,{ok:false,error:"method_not_allowed"})}
    const user=await resolveAdFilmUser(req);if(!user)return sendJson(res,401,{ok:false,error:"unauthorized"});
    const projectId=clean(req.body?.projectId,120);if(!projectId)return sendJson(res,400,{ok:false,error:"missing_project_id"});
    const project=await getOwnedProject(user,projectId);if(!project)return sendJson(res,404,{ok:false,error:"project_not_found"});
    const currentMusic=project.music||{};
    const requestedStyle=clean(req.body?.musicStyle,40)||currentMusic.style||"auto";
    const requestedEnergy=clean(req.body?.musicEnergy,40)||currentMusic.energy||"balanced";
    const requestedDuration=normalizeDuration(req.body?.duration);
    const music={...currentMusic,style:requestedStyle,energy:requestedEnergy};
    if(music.mode==="off")return sendJson(res,200,{ok:true,status:"DISABLED",project});
    if(music.mode==="upload"&&project.media?.musicTrack?.url)return sendJson(res,200,{ok:true,status:"COMPLETED",audio:project.media.musicTrack,project});
    if(!requestedDuration){
      return sendJson(res,400,{
        ok:false,
        error:"invalid_music_duration",
        message:"Music duration must be an exact whole second between 5 and 15.",
        received_duration:req.body?.duration??null,
      });
    }

    const prompt=buildAdFilmMusicPrompt({
      productName:project.brief?.productName,brandName:project.brief?.brandName,description:project.brief?.description,targetAudience:project.brief?.targetAudience,cta:project.brief?.cta,
      voiceStyle:project.narration?.voiceStyle,visualStyle:project.sceneStyle,duration:requestedDuration,musicStyle:requestedStyle,musicEnergy:requestedEnergy,voiceEnabled:project.narration?.enabled!==false
    });
    const signature=profileSignature(prompt);

    if(reusableAudio(currentMusic.audio,signature,requestedDuration)){
      const reused=await saveProject(user,{...project,music:{...music,audio:currentMusic.audio}});
      return sendJson(res,200,{
        ok:true,
        status:"COMPLETED",
        reused:true,
        requested_duration:requestedDuration,
        output_format:OUTPUT_FORMAT,
        signature,
        audio:currentMusic.audio,
        project:reused,
      });
    }
    const active=project.musicGeneration;
    if(
      active&&
      ["queued","processing"].includes(String(active.status))&&
      Number(active.qualityVersion)>=QUALITY_VERSION&&
      Number(active.profileVersion)>=PROFILE_VERSION&&
      Number(active.meta?.duration)===requestedDuration&&
      clean(active.signature,80)===signature
    )return sendJson(res,200,{
      ok:true,
      status:active.status==="queued"?"IN_QUEUE":"RUNNING",
      reused:false,
      requested_duration:requestedDuration,
      output_format:OUTPUT_FORMAT,
      signature,
      generation:active,
      project,
    });
    const key=falKey();if(!key)return sendJson(res,500,{ok:false,error:"missing_fal_key",message:"FAL_KEY is not available."});

    const payload={
      prompt:prompt.prompt,
      negative_prompt:prompt.negativePrompt,
      duration:Number(prompt.duration),
      num_inference_steps:NUM_INFERENCE_STEPS,
      guidance_scale:GUIDANCE_SCALE,
      enable_prompt_expansion:ENABLE_PROMPT_EXPANSION,
      enable_safety_checker:ENABLE_SAFETY_CHECKER,
      sync_mode:false,
      output_format:OUTPUT_FORMAT,
      bitrate:OUTPUT_BITRATE
    };

    let attempt=await submit(key,PRIMARY_MODEL,payload);
    let fallbackUsed=false;
    if(!attempt.response.ok){fallbackUsed=true;attempt=await submit(key,FALLBACK_MODEL,payload)}

    const data=attempt.data;
    if(!attempt.response.ok){
      const message=errorMessage(data,attempt.response.status);
      const now=new Date().toISOString();
      const failed=await saveProject(user,{...project,music:{...music,audio:null},musicGeneration:{provider:"fal",model:attempt.model,status:"failed",startedAt:active?.startedAt||now,updatedAt:now,completedAt:now,error:message,falStatus:attempt.response.status,falResponse:data,prompt:prompt.prompt,fallbackUsed,qualityVersion:QUALITY_VERSION,profileVersion:PROFILE_VERSION,signature,outputFormat:OUTPUT_FORMAT,bitrate:OUTPUT_BITRATE,meta:prompt}});
      return sendJson(res,attempt.response.status,{ok:false,error:"fal_error",message,fal_status:attempt.response.status,fal_response:data,project:failed});
    }

    const requestId=clean(pick(data,["request_id","requestId","id"]),240);
    const statusUrl=clean(pick(data,["status_url","statusUrl","urls.status"]),1600);
    const responseUrl=clean(pick(data,["response_url","responseUrl","urls.response"]),1600);
    if(!requestId)return sendJson(res,502,{ok:false,error:"fal_missing_request_id",message:"Fal accepted the music request but returned no request id.",fal_response:data});
    const now=new Date().toISOString();
    const saved=await saveProject(user,{
      ...project,
      music:{...music,audio:null},
      musicGeneration:{provider:"fal",model:attempt.model,requestId,statusUrl:statusUrl||null,responseUrl:responseUrl||null,status:"queued",startedAt:now,updatedAt:now,error:null,fallbackUsed,qualityVersion:QUALITY_VERSION,profileVersion:PROFILE_VERSION,signature,outputFormat:OUTPUT_FORMAT,bitrate:OUTPUT_BITRATE,prompt:prompt.prompt,meta:prompt}
    });
    return sendJson(res,200,{
      ok:true,
      status:"IN_QUEUE",
      reused:false,
      requested_duration:requestedDuration,
      output_format:OUTPUT_FORMAT,
      bitrate:OUTPUT_BITRATE,
      signature,
      generation:saved.musicGeneration,
      project:saved,
      fallback_used:fallbackUsed,
    });
  }catch(error){console.error("[ad-film/music/create]",error);return sendJson(res,500,{ok:false,error:"server_error",message:clean(error?.message||error,900)})}
}
