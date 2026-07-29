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
function audioUrl(data){const obj=pick(data,["audio","output.audio","data.audio","result.audio"]);if(obj&&typeof obj==="object"&&/^https:\/\//i.test(String(obj.url||"")))return obj.url;const url=pick(data,["audio_url","output.audio_url","data.audio_url","result.audio_url"]);return /^https:\/\//i.test(String(url||""))?String(url):""}
function norm(value,url){if(url)return"COMPLETED";const s=String(value||"").toUpperCase();if(["COMPLETED","COMPLETE","SUCCEEDED","READY","DONE"].includes(s))return"COMPLETED";if(["RUNNING","IN_PROGRESS","PROCESSING","STARTED"].includes(s))return"RUNNING";if(["IN_QUEUE","QUEUED","PENDING"].includes(s))return"IN_QUEUE";if(["FAILED","ERROR","CANCELLED","CANCELED"].includes(s))return"FAILED";return"UNKNOWN"}
async function falGet(url,key){const r=await fetch(url,{headers:{Authorization:`Key ${key}`,Accept:"application/json"}});let d={};try{d=JSON.parse(await r.text())}catch(_){}return{r,d}}

export default async function handler(req,res){
  try{
    if(req.method!=="GET"){res.setHeader("Allow","GET");return sendJson(res,405,{ok:false,error:"method_not_allowed"})}
    const user=await resolveAdFilmUser(req);if(!user)return sendJson(res,401,{ok:false,error:"unauthorized"});
    const projectId=clean(req.query?.projectId,120);if(!projectId)return sendJson(res,400,{ok:false,error:"missing_project_id"});
    const project=await getOwnedProject(user,projectId);if(!project)return sendJson(res,404,{ok:false,error:"project_not_found"});
    if(project.music?.audio?.url)return sendJson(res,200,{ok:true,status:"COMPLETED",audio:project.music.audio,project});
    const g=project.musicGeneration||{};if(!g.requestId)return sendJson(res,200,{ok:true,status:"IDLE"});
    const key=falKey();if(!key)return sendJson(res,500,{ok:false,error:"missing_fal_key"});
    const statusUrl=clean(g.statusUrl)||`https://queue.fal.run/${g.model}/requests/${encodeURIComponent(g.requestId)}/status`;
    const first=await falGet(statusUrl,key);if(!first.r.ok)return sendJson(res,502,{ok:false,error:"fal_status_error"});
    let url=audioUrl(first.d);let status=norm(pick(first.d,["status","state","data.status","result.status"]),url);
    if(!url&&status==="COMPLETED"){
      const resultUrl=clean(g.responseUrl)||statusUrl.replace(/\/status\/?(?:\?.*)?$/i,"");
      const second=await falGet(resultUrl,key);if(second.r.ok)url=audioUrl(second.d);status=norm("COMPLETED",url);
    }
    if(status==="FAILED"){
      const saved=await saveProject(user,{...project,musicGeneration:{...g,status:"failed",updatedAt:new Date().toISOString(),error:"music_generation_failed"}});
      return sendJson(res,200,{ok:true,status:"FAILED",project:saved});
    }
    if(!url)return sendJson(res,200,{ok:true,status,g.status==="queued"?"IN_QUEUE":"RUNNING"});
    const response=await fetch(url);if(!response.ok)return sendJson(res,502,{ok:false,error:"music_download_failed"});
    const body=Buffer.from(await response.arrayBuffer());if(!body.length||body.length>40*1024*1024)return sendJson(res,413,{ok:false,error:"invalid_music_size"});
    const now=new Date().toISOString();const keyPath=`${mediaPrefix(user,projectId)}music/generated-${Date.now()}.wav`;
    const stored=await putObject({key:keyPath,body,contentType:"audio/wav",cacheControl:"public, max-age=31536000, immutable",contentDisposition:"inline"});
    const audio={url:stored,contentType:"audio/wav",generated:true,createdAt:now,engine:g.model,style:g.meta?.resolvedStyle||project.music?.style||"auto",energy:g.meta?.resolvedEnergy||project.music?.energy||"balanced"};
    const saved=await saveProject(user,{...project,music:{...(project.music||{}),audio},musicGeneration:{...g,status:"completed",updatedAt:now,completedAt:now,error:null}});
    return sendJson(res,200,{ok:true,status:"COMPLETED",audio,project:saved});
  }catch(error){console.error("[ad-film/music/status]",error);return sendJson(res,500,{ok:false,error:"server_error",message:String(error?.message||error)})}
}
