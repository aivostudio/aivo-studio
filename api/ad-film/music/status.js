// api/ad-film/music/status.js
export const config = { runtime: "nodejs" };

import { putObject } from "../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const QUALITY_VERSION = 4;
const PROFILE_VERSION = 2;
const OUTPUT_FORMAT = "mp3";
const OUTPUT_BITRATE = "192k";
const PIPELINE_VERSION = "adfilm-music-v4-exact-duration-mp3";

function clean(value,max=1800){return String(value??"").trim().slice(0,max)}
function falKey(){return process.env.FAL_KEY||process.env.FAL_API_KEY||""}
function pick(data,keys){for(const key of keys){const parts=key.split(".");let cur=data,ok=true;for(const p of parts){if(!cur||typeof cur!=="object"||!(p in cur)){ok=false;break}cur=cur[p]}if(ok&&cur!=null)return cur}return null}
function audioFile(data){
  const obj=pick(data,["audio","output.audio","data.audio","result.audio","response.audio"]);
  if(obj&&typeof obj==="object"&&/^https:\/\//i.test(String(obj.url||"")))return{url:String(obj.url),contentType:clean(obj.content_type||obj.contentType,100),fileName:clean(obj.file_name||obj.fileName,180)};
  const url=pick(data,["audio_url","output.audio_url","data.audio_url","result.audio_url","response.audio_url"]);
  return /^https:\/\//i.test(String(url||""))?{url:String(url),contentType:"",fileName:""}:null;
}
function norm(value,url){if(url)return"COMPLETED";const s=String(value||"").toUpperCase();if(["COMPLETED","COMPLETE","SUCCEEDED","READY","DONE"].includes(s))return"COMPLETED";if(["RUNNING","IN_PROGRESS","PROCESSING","STARTED"].includes(s))return"RUNNING";if(["IN_QUEUE","QUEUED","PENDING"].includes(s))return"IN_QUEUE";if(["FAILED","ERROR","CANCELLED","CANCELED"].includes(s))return"FAILED";return"UNKNOWN"}
function errorMessage(data,status){const detail=pick(data,["detail.0.msg","detail","message","error","data.detail","data.message","logs.0.message"]);if(typeof detail==="string"&&detail.trim())return clean(detail,900);if(detail&&typeof detail==="object")return clean(JSON.stringify(detail),900);return`Fal HTTP ${status}`}
async function falGet(url,key){const r=await fetch(url,{headers:{Authorization:`Key ${key}`,Accept:"application/json"}});let text="",d={};try{text=await r.text();d=text?JSON.parse(text):{}}catch(_){d={raw:text}}return{r,d}}
function extension(file){
  const source=`${file?.contentType||""} ${file?.fileName||""} ${file?.url||""}`.toLowerCase();
  if(source.includes("audio/mpeg")||source.includes("audio/mp3")||source.includes(".mp3"))return{ext:"mp3",type:"audio/mpeg"};
  if(source.includes("wav"))return{ext:"wav",type:"audio/wav"};
  if(source.includes("flac"))return{ext:"flac",type:"audio/flac"};
  if(source.includes("ogg"))return{ext:"ogg",type:"audio/ogg"};
  return{ext:"mp3",type:"audio/mpeg"};
}
function validDuration(value){const duration=Number(value);return Number.isInteger(duration)&&duration>=5&&duration<=15?duration:null}
function isMp3Audio(audio){
  const url=clean(audio?.url,1800).toLowerCase().split("?")[0];
  const type=clean(audio?.contentType,100).toLowerCase();
  return type==="audio/mpeg"||type==="audio/mp3"||url.endsWith(".mp3");
}
function currentAudioMatches(project,g){
  const audio=project.music?.audio;
  const duration=validDuration(g.meta?.duration);
  return !!(
    audio?.url&&
    duration&&
    Number(g.qualityVersion)>=QUALITY_VERSION&&
    Number(g.profileVersion)>=PROFILE_VERSION&&
    clean(g.outputFormat,40).toLowerCase()===OUTPUT_FORMAT&&
    Number(audio.qualityVersion)>=QUALITY_VERSION&&
    Number(audio.profileVersion)>=PROFILE_VERSION&&
    Number(audio.duration)===duration&&
    clean(audio.signature,80)&&
    clean(audio.signature,80)===clean(g.signature,80)&&
    isMp3Audio(audio)
  );
}
function diagnostic(g){
  return{
    pipeline_version:PIPELINE_VERSION,
    requested_duration:validDuration(g.meta?.duration),
    output_format:clean(g.outputFormat,40).toLowerCase()||null,
    bitrate:clean(g.bitrate,40)||null,
    quality_version:Number(g.qualityVersion)||null,
    profile_version:Number(g.profileVersion)||null,
    signature:clean(g.signature,80)||null,
  };
}

export default async function handler(req,res){
  try{
    if(req.method!=="GET"){res.setHeader("Allow","GET");return sendJson(res,405,{ok:false,error:"method_not_allowed",pipeline_version:PIPELINE_VERSION})}
    const user=await resolveAdFilmUser(req);if(!user)return sendJson(res,401,{ok:false,error:"unauthorized",pipeline_version:PIPELINE_VERSION});
    const projectId=clean(req.query?.projectId,120);if(!projectId)return sendJson(res,400,{ok:false,error:"missing_project_id",pipeline_version:PIPELINE_VERSION});
    const project=await getOwnedProject(user,projectId);if(!project)return sendJson(res,404,{ok:false,error:"project_not_found",pipeline_version:PIPELINE_VERSION});
    const g=project.musicGeneration||{};
    const diag=diagnostic(g);

    if(currentAudioMatches(project,g))return sendJson(res,200,{ok:true,status:"COMPLETED",audio:project.music.audio,project,...diag});
    if(g.status==="failed")return sendJson(res,200,{ok:true,status:"FAILED",error:g.error||"music_generation_failed",project,...diag});
    if(!g.requestId)return sendJson(res,200,{ok:true,status:"IDLE",project,...diag});

    const duration=validDuration(g.meta?.duration);
    const compatible=(
      duration&&
      Number(g.qualityVersion)>=QUALITY_VERSION&&
      Number(g.profileVersion)>=PROFILE_VERSION&&
      clean(g.outputFormat,40).toLowerCase()===OUTPUT_FORMAT&&
      clean(g.signature,80)
    );
    if(!compatible){
      return sendJson(res,409,{
        ok:false,
        error:"stale_music_generation",
        message:"This music job belongs to an older pipeline and cannot be finalized by the current music pipeline.",
        project,
        ...diag,
      });
    }

    const key=falKey();if(!key)return sendJson(res,500,{ok:false,error:"missing_fal_key",message:"FAL_KEY is not available.",...diag});
    const statusUrl=clean(g.statusUrl)||`https://queue.fal.run/${g.model}/requests/${encodeURIComponent(g.requestId)}/status`;
    const first=await falGet(statusUrl,key);
    if(!first.r.ok){
      const message=errorMessage(first.d,first.r.status),now=new Date().toISOString();
      const saved=await saveProject(user,{...project,musicGeneration:{...g,status:"failed",updatedAt:now,completedAt:now,error:message,falStatus:first.r.status,falResponse:first.d}});
      return sendJson(res,200,{ok:true,status:"FAILED",error:message,project:saved,...diag});
    }
    let file=audioFile(first.d);let status=norm(pick(first.d,["status","state","data.status","result.status"]),file?.url);
    if(!file&&status==="COMPLETED"){
      const resultUrl=clean(g.responseUrl)||statusUrl.replace(/\/status\/?(?:\?.*)?$/i,"");
      const second=await falGet(resultUrl,key);
      if(!second.r.ok&&second.r.status!==202){
        const message=errorMessage(second.d,second.r.status),now=new Date().toISOString();
        const saved=await saveProject(user,{...project,musicGeneration:{...g,status:"failed",updatedAt:now,completedAt:now,error:message,falStatus:second.r.status,falResponse:second.d}});
        return sendJson(res,200,{ok:true,status:"FAILED",error:message,project:saved,...diag});
      }
      if(second.r.ok)file=audioFile(second.d);
      status=norm("COMPLETED",file?.url);
    }
    if(status==="FAILED"){
      const message=errorMessage(first.d,200)||"music_generation_failed",now=new Date().toISOString();
      const saved=await saveProject(user,{...project,musicGeneration:{...g,status:"failed",updatedAt:now,completedAt:now,error:message,falResponse:first.d}});
      return sendJson(res,200,{ok:true,status:"FAILED",error:message,project:saved,...diag});
    }
    if(!file?.url){
      const nextStatus=status==="IN_QUEUE"?"queued":"processing";
      let nextProject=project;
      if(g.status!==nextStatus)nextProject=await saveProject(user,{...project,musicGeneration:{...g,status:nextStatus,updatedAt:new Date().toISOString(),error:null}});
      return sendJson(res,200,{ok:true,status:status==="IN_QUEUE"?"IN_QUEUE":"RUNNING",project:nextProject,...diag});
    }

    const response=await fetch(file.url,{cache:"no-store",redirect:"follow"});if(!response.ok)return sendJson(res,502,{ok:false,error:"music_download_failed",message:`Music download HTTP ${response.status}`,...diag});
    const body=Buffer.from(await response.arrayBuffer());if(!body.length||body.length>80*1024*1024)return sendJson(res,413,{ok:false,error:"invalid_music_size",...diag});
    const format=extension({...file,url:file.url,contentType:file.contentType||response.headers.get("content-type")});
    if(format.ext!==OUTPUT_FORMAT){
      const now=new Date().toISOString();
      const message=`Unexpected music format: ${format.ext}`;
      const saved=await saveProject(user,{...project,musicGeneration:{...g,status:"failed",updatedAt:now,completedAt:now,error:message}});
      return sendJson(res,200,{ok:true,status:"FAILED",error:message,project:saved,...diag});
    }

    const now=new Date().toISOString();
    const keyPath=`${mediaPrefix(user,projectId)}music/generated-v4-${Date.now()}.mp3`;
    const stored=await putObject({key:keyPath,body,contentType:"audio/mpeg",cacheControl:"public, max-age=31536000, immutable",contentDisposition:"inline"});
    const audio={
      url:stored,
      contentType:"audio/mpeg",
      generated:true,
      createdAt:now,
      engine:g.model,
      qualityVersion:QUALITY_VERSION,
      profileVersion:PROFILE_VERSION,
      pipelineVersion:PIPELINE_VERSION,
      signature:g.signature,
      lossless:false,
      style:g.meta?.resolvedStyle||project.music?.style||"auto",
      energy:g.meta?.resolvedEnergy||project.music?.energy||"balanced",
      duration,
      outputFormat:OUTPUT_FORMAT,
      bitrate:g.bitrate||OUTPUT_BITRATE,
    };
    const saved=await saveProject(user,{...project,music:{...(project.music||{}),audio},musicGeneration:{...g,status:"completed",updatedAt:now,completedAt:now,error:null,pipelineVersion:PIPELINE_VERSION}});
    return sendJson(res,200,{ok:true,status:"COMPLETED",audio,project:saved,...diag});
  }catch(error){console.error("[ad-film/music/status]",error);return sendJson(res,500,{ok:false,error:"server_error",message:clean(error?.message||error,900),pipeline_version:PIPELINE_VERSION})}
}
