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
function extension(file){const source=`${file?.contentType||""} ${file?.fileName||""}`.toLowerCase();if(source.includes("wav"))return{ext:"wav",type:"audio/wav"};if(source.includes("flac"))return{ext:"flac",type:"audio/flac"};if(source.includes("ogg"))return{ext:"ogg",type:"audio/ogg"};return{ext:"mp3",type:"audio/mpeg"}}

export default async function handler(req,res){
  try{
    if(req.method!=="GET"){res.setHeader("Allow","GET");return sendJson(res,405,{ok:false,error:"method_not_allowed"})}
    const user=await resolveAdFilmUser(req);if(!user)return sendJson(res,401,{ok:false,error:"unauthorized"});
    const projectId=clean(req.query?.projectId,120);if(!projectId)return sendJson(res,400,{ok:false,error:"missing_project_id"});
    const project=await getOwnedProject(user,projectId);if(!project)return sendJson(res,404,{ok:false,error:"project_not_found"});
    const g=project.musicGeneration||{};
    if(
      project.music?.audio?.url&&
      Number(project.music.audio.qualityVersion)>=2&&
      Number(project.music.audio.profileVersion)>=1&&
      clean(project.music.audio.signature,80)&&
      clean(project.music.audio.signature,80)===clean(g.signature,80)
    )return sendJson(res,200,{ok:true,status:"COMPLETED",audio:project.music.audio,project});
    if(g.status==="failed")return sendJson(res,200,{ok:true,status:"FAILED",error:g.error||"music_generation_failed",project});
    if(!g.requestId)return sendJson(res,200,{ok:true,status:"IDLE",project});
    const key=falKey();if(!key)return sendJson(res,500,{ok:false,error:"missing_fal_key",message:"FAL_KEY is not available."});
    const statusUrl=clean(g.statusUrl)||`https://queue.fal.run/${g.model}/requests/${encodeURIComponent(g.requestId)}/status`;
    const first=await falGet(statusUrl,key);
    if(!first.r.ok){
      const message=errorMessage(first.d,first.r.status),now=new Date().toISOString();
      const saved=await saveProject(user,{...project,musicGeneration:{...g,status:"failed",updatedAt:now,completedAt:now,error:message,falStatus:first.r.status,falResponse:first.d}});
      return sendJson(res,200,{ok:true,status:"FAILED",error:message,project:saved});
    }
    let file=audioFile(first.d);let status=norm(pick(first.d,["status","state","data.status","result.status"]),file?.url);
    if(!file&&status==="COMPLETED"){
      const resultUrl=clean(g.responseUrl)||statusUrl.replace(/\/status\/?(?:\?.*)?$/i,"");
      const second=await falGet(resultUrl,key);
      if(!second.r.ok&&second.r.status!==202){
        const message=errorMessage(second.d,second.r.status),now=new Date().toISOString();
        const saved=await saveProject(user,{...project,musicGeneration:{...g,status:"failed",updatedAt:now,completedAt:now,error:message,falStatus:second.r.status,falResponse:second.d}});
        return sendJson(res,200,{ok:true,status:"FAILED",error:message,project:saved});
      }
      if(second.r.ok)file=audioFile(second.d);
      status=norm("COMPLETED",file?.url);
    }
    if(status==="FAILED"){
      const message=errorMessage(first.d,200)||"music_generation_failed",now=new Date().toISOString();
      const saved=await saveProject(user,{...project,musicGeneration:{...g,status:"failed",updatedAt:now,completedAt:now,error:message,falResponse:first.d}});
      return sendJson(res,200,{ok:true,status:"FAILED",error:message,project:saved});
    }
    if(!file?.url){
      const nextStatus=status==="IN_QUEUE"?"queued":"processing";
      let nextProject=project;
      if(g.status!==nextStatus)nextProject=await saveProject(user,{...project,musicGeneration:{...g,status:nextStatus,updatedAt:new Date().toISOString(),error:null}});
      return sendJson(res,200,{ok:true,status:status==="IN_QUEUE"?"IN_QUEUE":"RUNNING",project:nextProject});
    }
    const response=await fetch(file.url,{cache:"no-store",redirect:"follow"});if(!response.ok)return sendJson(res,502,{ok:false,error:"music_download_failed",message:`Music download HTTP ${response.status}`});
    const body=Buffer.from(await response.arrayBuffer());if(!body.length||body.length>80*1024*1024)return sendJson(res,413,{ok:false,error:"invalid_music_size"});
    const format=extension({...file,contentType:file.contentType||response.headers.get("content-type")});
    const now=new Date().toISOString();const keyPath=`${mediaPrefix(user,projectId)}music/generated-v2-${Date.now()}.${format.ext}`;
    const stored=await putObject({key:keyPath,body,contentType:format.type,cacheControl:"public, max-age=31536000, immutable",contentDisposition:"inline"});
    const audio={url:stored,contentType:format.type,generated:true,createdAt:now,engine:g.model,qualityVersion:g.qualityVersion||2,profileVersion:g.profileVersion||1,signature:g.signature||null,lossless:format.ext==="wav"||format.ext==="flac",style:g.meta?.resolvedStyle||project.music?.style||"auto",energy:g.meta?.resolvedEnergy||project.music?.energy||"balanced",duration:g.meta?.duration||project.output?.duration||10};
    const saved=await saveProject(user,{...project,music:{...(project.music||{}),audio},musicGeneration:{...g,status:"completed",updatedAt:now,completedAt:now,error:null}});
    return sendJson(res,200,{ok:true,status:"COMPLETED",audio,project:saved});
  }catch(error){console.error("[ad-film/music/status]",error);return sendJson(res,500,{ok:false,error:"server_error",message:clean(error?.message||error,900)})}
}
