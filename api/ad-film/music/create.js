// api/ad-film/music/create.js
export const config = { runtime: "nodejs" };

import { buildAdFilmMusicPrompt } from "../../_lib/ad-film-music-prompt.js";
import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const MODEL = "fal-ai/stable-audio-3/small/music/text-to-audio";
const QUEUE_URL = `https://queue.fal.run/${MODEL}`;

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
async function submit(key,payload){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetch(QUEUE_URL,{method:"POST",headers:{Authorization:`Key ${key}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload),signal:controller.signal});
    const data=parse(await response.text().catch(()=>""));
    return{response,data};
  }finally{clearTimeout(timeout)}
}

export default async function handler(req,res){
  try{
    if(req.method!=="POST"){res.setHeader("Allow","POST");return sendJson(res,405,{ok:false,error:"method_not_allowed"})}
    const user=await resolveAdFilmUser(req);if(!user)return sendJson(res,401,{ok:false,error:"unauthorized"});
    const projectId=clean(req.body?.projectId,120);if(!projectId)return sendJson(res,400,{ok:false,error:"missing_project_id"});
    const project=await getOwnedProject(user,projectId);if(!project)return sendJson(res,404,{ok:false,error:"project_not_found"});
    const music=project.music||{};
    if(music.mode==="off")return sendJson(res,200,{ok:true,status:"DISABLED",project});
    if(music.mode==="upload"&&project.media?.musicTrack?.url)return sendJson(res,200,{ok:true,status:"COMPLETED",audio:project.media.musicTrack,project});
    if(music.audio?.url)return sendJson(res,200,{ok:true,status:"COMPLETED",audio:music.audio,project});
    const active=project.musicGeneration;
    if(active&&["queued","processing"].includes(String(active.status)))return sendJson(res,200,{ok:true,status:active.status==="queued"?"IN_QUEUE":"RUNNING",generation:active,project});
    const key=falKey();if(!key)return sendJson(res,500,{ok:false,error:"missing_fal_key",message:"FAL_KEY is not available."});

    const prompt=buildAdFilmMusicPrompt({
      productName:project.brief?.productName,brandName:project.brief?.brandName,description:project.brief?.description,targetAudience:project.brief?.targetAudience,cta:project.brief?.cta,
      voiceStyle:project.narration?.voiceStyle,visualStyle:project.sceneStyle,duration:project.output?.duration||15,musicStyle:music.style||"auto",musicEnergy:music.energy||"balanced",voiceEnabled:project.narration?.enabled!==false
    });

    const richPayload={prompt:prompt.prompt,negative_prompt:prompt.negativePrompt,duration:Number(prompt.duration),num_inference_steps:8,guidance_scale:1,enable_prompt_expansion:true,enable_safety_checker:true,sync_mode:false,output_format:"mp3",bitrate:"192k"};
    let attempt=await submit(key,richPayload);
    let retryUsed=false;

    /* Some provider revisions can reject optional fields even though they are
       documented. Retry once with the official minimal schema before failing. */
    if(!attempt.response.ok){
      retryUsed=true;
      attempt=await submit(key,{prompt:prompt.prompt,duration:Number(prompt.duration),num_inference_steps:8,guidance_scale:1,enable_safety_checker:true,output_format:"mp3",bitrate:"192k"});
    }

    const data=attempt.data;
    if(!attempt.response.ok){
      const message=errorMessage(data,attempt.response.status);
      const now=new Date().toISOString();
      const failed=await saveProject(user,{...project,musicGeneration:{provider:"fal",model:MODEL,status:"failed",startedAt:active?.startedAt||now,updatedAt:now,completedAt:now,error:message,falStatus:attempt.response.status,falResponse:data,prompt:prompt.prompt,retryUsed,meta:prompt}});
      return sendJson(res,attempt.response.status,{ok:false,error:"fal_error",message,fal_status:attempt.response.status,fal_response:data,project:failed});
    }

    const requestId=clean(pick(data,["request_id","requestId","id"]),240);
    const statusUrl=clean(pick(data,["status_url","statusUrl","urls.status"]),1600);
    const responseUrl=clean(pick(data,["response_url","responseUrl","urls.response"]),1600);
    if(!requestId){
      const message="Fal accepted the music request but returned no request id.";
      return sendJson(res,502,{ok:false,error:"fal_missing_request_id",message,fal_response:data});
    }
    const now=new Date().toISOString();
    const saved=await saveProject(user,{...project,musicGeneration:{provider:"fal",model:MODEL,requestId,statusUrl:statusUrl||null,responseUrl:responseUrl||null,status:"queued",startedAt:now,updatedAt:now,error:null,retryUsed,prompt:prompt.prompt,meta:prompt}});
    return sendJson(res,200,{ok:true,status:"IN_QUEUE",generation:saved.musicGeneration,project:saved});
  }catch(error){console.error("[ad-film/music/create]",error);return sendJson(res,500,{ok:false,error:"server_error",message:clean(error?.message||error,900)})}
}
