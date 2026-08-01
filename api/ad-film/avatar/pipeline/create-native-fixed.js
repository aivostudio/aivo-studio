// api/ad-film/avatar/pipeline/create-native-fixed.js
// Normalizes native-scene references, product scale and lipsync timing.
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import nativeHandler from "./create-native.js";
import { inferProductProfile } from "../../../_lib/ad-film-director.js";
import { buildAdFilmTimeline } from "../../../_lib/ad-film-timeline.js";
import { putObject } from "../../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../../_lib/ad-film-projects.js";

const PRODUCT_CANVAS_SIZE = 1600;

function clean(value, max = 4000) { return String(value ?? "").trim().slice(0, max); }
function parseJson(value) { try { return value ? JSON.parse(value) : {}; } catch (_) { return {}; } }
function isHttpUrl(value) { return /^https:\/\//i.test(clean(value, 4000)); }
function normalizeAvatarDuration(value) { const duration=String(value??"").trim(); return ["10","15"].includes(duration)?duration:"10"; }
function runFfmpeg(args) {
  return new Promise((resolve,reject)=>{
    const child=spawn(ffmpegPath,args,{stdio:["ignore","ignore","pipe"]});
    let stderr="";
    child.stderr.on("data",chunk=>{stderr+=chunk.toString();if(stderr.length>20000)stderr=stderr.slice(-20000)});
    child.on("error",reject);
    child.on("close",code=>code===0?resolve():reject(new Error(stderr||`ffmpeg_failed:${code}`)));
  });
}
function stableMediaUrl(value) {
  const source=clean(value,4000); if(!isHttpUrl(source))return"";
  try {
    const url=new URL(source);
    if(/\.r2\.cloudflarestorage\.com$/i.test(url.hostname)){
      let pathname=url.pathname.replace(/^\/+/,"").replace(/^aivo-archive\//i,"");
      if(pathname.startsWith("uploads/"))return`https://media.aivo.tr/${pathname}`;
    }
    url.search="";url.hash="";return url.toString();
  } catch(_){return source}
}
function uniqueUrls(values) {
  const result=[],seen=new Set();
  for(const value of Array.isArray(values)?values:[]){const url=stableMediaUrl(value?.url||value);if(!url||seen.has(url))continue;seen.add(url);result.push(url);if(result.length>=9)break}
  return result;
}
function referenceUrls(project) {
  const generation=project?.generation||{};
  const recovery=uniqueUrls(project?.avatar?.nativeReferencePatch?.originalImageUrls);if(recovery.length)return recovery;
  const candidates=[generation?.input?.image_urls,generation?.input?.imageUrls,generation?.retryInput?.image_urls,generation?.retryInput?.imageUrls,project?.media?.productImages];
  for(const candidate of candidates){const urls=uniqueUrls(candidate);if(urls.length)return urls}
  return[];
}
function normalizeIndex(value,count){const number=Number.parseInt(value,10);return Number.isFinite(number)&&number>=1&&number<=count?number:null}
function normalizeIndexList(values,count,excluded=new Set()){
  const result=[],seen=new Set(excluded);
  for(const value of Array.isArray(values)?values:[]){const index=normalizeIndex(value,count);if(!index||seen.has(index))continue;seen.add(index);result.push(index)}
  return result;
}
function referenceMap(project,count){
  const generation=project?.generation||{};
  const source=project?.avatar?.nativeReferencePatch?.referenceMap||generation?.input?.reference_map||generation?.input?.referenceMap||generation?.referenceMap||generation?.reference_map||generation?.retryInput?.referenceMap||generation?.retryInput?.reference_map||{};
  const hero=normalizeIndex(source?.hero,count)||1,used=new Set([hero]);
  let angles=normalizeIndexList(source?.angles,count,used).slice(0,3);angles.forEach(index=>used.add(index));
  let scenes=normalizeIndexList(source?.scenes,count,used).slice(0,5);
  if(!angles.length){angles=Array.from({length:Math.min(2,Math.max(0,count-1))},(_,offset)=>offset+2).filter(index=>index<=count&&index!==hero);angles.forEach(index=>used.add(index))}
  if(!scenes.length)scenes=Array.from({length:count},(_,offset)=>offset+1).filter(index=>!used.has(index)).slice(0,5);
  return{hero,angles,scenes};
}
async function downloadBuffer(url,maxBytes=35*1024*1024){
  const response=await fetch(url,{method:"GET",cache:"no-store",redirect:"follow"});
  if(!response.ok)throw new Error(`media_download_failed:${response.status}`);
  const body=Buffer.from(await response.arrayBuffer());if(!body.length||body.length>maxBytes)throw new Error("invalid_media_size");return body;
}
function innerSizeFor(profile){const scaleClass=clean(profile?.scaleClass,80);if(["full_size_vehicle","floor_standing","human_environment"].includes(scaleClass))return1260;if(["countertop","desk_portable","serving_size"].includes(scaleClass))return980;if(["small_handheld","body_worn_small"].includes(scaleClass))return640;if(scaleClass==="body_worn")return820;return820}
async function createScaleSafeProductReference(sourceUrl,user,projectId,profile){
  const source=await downloadBuffer(sourceUrl),innerSize=innerSizeFor(profile);
  const product=await sharp(source).rotate().ensureAlpha().resize(innerSize,innerSize,{fit:"contain",position:"center",background:{r:0,g:0,b:0,alpha:0},withoutEnlargement:true}).png().toBuffer();
  const padded=await sharp({create:{width:PRODUCT_CANVAS_SIZE,height:PRODUCT_CANVAS_SIZE,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:product,gravity:"center"}]).png({compressionLevel:9}).toBuffer();
  const key=`${mediaPrefix(user,projectId)}avatar/pipeline/product-scale-safe-${Date.now()}.png`;
  return putObject({key,body:padded,contentType:"image/png",cacheControl:"public, max-age=31536000, immutable",contentDisposition:"inline"});
}
function dynamicDirectorNote(project,original){
  const profile=inferProductProfile({productName:project?.brief?.productName,brandName:project?.brief?.brandName,description:project?.brief?.description});
  const contract=[`Product category is ${profile.label}.`,profile.scaleInstruction,profile.integrityInstruction,profile.forbiddenTransformations,`Allowed interactions only: ${profile.allowedInteractions}`].filter(Boolean).join(" ");
  const source=clean(original,1000),available=Math.max(0,1000-contract.length-1);
  return{note:`${contract} ${source.slice(0,available)}`.trim(),profile};
}
async function createTimelineNarrationClip(project,user,projectId,duration){
  const audio=project?.narration?.audio;
  if(project?.narration?.enabled===false||audio?.approved!==true||!isHttpUrl(audio?.url))return null;
  const timeline=buildAdFilmTimeline({duration:Number(duration),avatarEnabled:true,shots:project?.productionPlan?.shots});
  const avatar=timeline.avatar;if(!avatar)return null;
  const speech=timeline.speech||{start:avatar.start,end:avatar.end,clipStart:0};
  const sourceStart=Math.max(0,Number(speech.start)||0);
  const sourceEnd=Math.max(sourceStart+0.5,Number(speech.end)||avatar.end);
  const lead=Math.max(0,Number(speech.clipStart)||0);
  const clipDuration=Math.max(0.5,Number(avatar.duration)||sourceEnd-sourceStart);
  const tmpDir=fs.mkdtempSync(path.join(os.tmpdir(),"aivo-lipsync-window-"));
  const input=path.join(tmpDir,"input-audio"),output=path.join(tmpDir,"timeline.wav");
  try{
    fs.writeFileSync(input,await downloadBuffer(audio.url,30*1024*1024));
    const delayMs=Math.round(lead*1000);
    const filter=`atrim=start=${sourceStart}:end=${sourceEnd},asetpts=PTS-STARTPTS,aresample=48000,adelay=${delayMs}|${delayMs},apad=pad_dur=${clipDuration+1},atrim=0:${clipDuration}`;
    await runFfmpeg(["-y","-i",input,"-af",filter,"-t",String(clipDuration),"-ar","48000","-ac","1","-c:a","pcm_s16le",output]);
    const key=`${mediaPrefix(user,projectId)}avatar/pipeline/lipsync-window-${Date.now()}.wav`;
    const url=await putObject({key,body:fs.readFileSync(output),contentType:"audio/wav",cacheControl:"public, max-age=31536000, immutable",contentDisposition:"inline"});
    return{url,timeline,sourceStart,sourceEnd,lead,clipDuration,originalAudio:audio};
  }finally{try{fs.rmSync(tmpDir,{recursive:true,force:true})}catch(_){}}
}
function createCaptureResponse(){const state={statusCode:200,headers:{},body:""};return{get statusCode(){return state.statusCode},set statusCode(value){state.statusCode=Number(value)||200},setHeader(name,value){state.headers[String(name).toLowerCase()]=value},getHeader(name){return state.headers[String(name).toLowerCase()]},end(chunk){state.body=chunk==null?"":Buffer.isBuffer(chunk)?chunk.toString("utf8"):String(chunk)},_state:state}}
async function restoreOriginalState(user,projectId,originalImageUrls,map,originalDirectorNote,originalNarrationAudio){
  const latest=await getOwnedProject(user,projectId);if(!latest)return null;
  const latestAvatar=latest.avatar||{}, {nativeReferencePatch,...avatarWithoutPatch}=latestAvatar;
  const generation=latest.generation||{},input=generation.input||{};
  const narration=latest.narration||{};
  return saveProject(user,{...latest,generation:{...generation,input:{...input,image_urls:originalImageUrls,imageUrls:originalImageUrls,reference_map:map,referenceMap:map},reference_map:map,referenceMap:map},narration:{...narration,audio:originalNarrationAudio||narration.audio},avatar:{...avatarWithoutPatch,directorNote:originalDirectorNote}});
}

export default async function handler(req,res){
  let user=null,projectId="",originalImageUrls=[],map=null,originalDirectorNote="",originalNarrationAudio=null,temporaryProjectSaved=false,restoredProject=null;
  try{
    if(req.method!=="POST"){res.setHeader("Allow","POST");return sendJson(res,405,{ok:false,error:"method_not_allowed"})}
    user=await resolveAdFilmUser(req);if(!user)return sendJson(res,401,{ok:false,error:"unauthorized"});
    projectId=clean(req.body?.projectId,120);if(!projectId)return sendJson(res,400,{ok:false,error:"missing_project_id"});
    let project=await getOwnedProject(user,projectId);if(!project)return sendJson(res,404,{ok:false,error:"project_not_found"});
    const recovery=project?.avatar?.nativeReferencePatch;
    if(Array.isArray(recovery?.originalImageUrls)&&recovery.originalImageUrls.length){project=await restoreOriginalState(user,projectId,uniqueUrls(recovery.originalImageUrls),recovery.referenceMap||referenceMap(project,recovery.originalImageUrls.length),clean(recovery.originalDirectorNote,1000),recovery.originalNarrationAudio||project?.narration?.audio)||project}
    originalImageUrls=referenceUrls(project);if(!originalImageUrls.length)return sendJson(res,409,{ok:false,error:"product_reference_required",message:"Ana ürün referansı bulunamadı. Ürün görsellerini yeniden seçmeden üretim başlatılamaz."});
    map=referenceMap(project,originalImageUrls.length);
    const heroIndex=Math.max(0,map.hero-1),avatar=project.avatar||{};
    originalDirectorNote=clean(avatar.directorNote,1000);originalNarrationAudio=project?.narration?.audio||null;
    const dynamic=dynamicDirectorNote(project,originalDirectorNote);
    const scaleSafeHeroUrl=await createScaleSafeProductReference(originalImageUrls[heroIndex],user,projectId,dynamic.profile);
    const nativeImageUrls=originalImageUrls.slice();nativeImageUrls[heroIndex]=scaleSafeHeroUrl;
    const duration=normalizeAvatarDuration(req.body?.duration||project?.output?.duration||project?.generation?.input?.duration);
    const narrationClip=await createTimelineNarrationClip(project,user,projectId,duration);
    const generation=project.generation||{};
    const temporaryProject=await saveProject(user,{...project,generation:{...generation,input:{...(generation.input||{}),image_urls:nativeImageUrls,imageUrls:nativeImageUrls,reference_map:map,referenceMap:map},reference_map:map,referenceMap:map},narration:narrationClip?{...(project.narration||{}),audio:{...originalNarrationAudio,url:narrationClip.url,timelineWindow:{start:narrationClip.sourceStart,end:narrationClip.sourceEnd,lead:narrationClip.lead}}}:project.narration,avatar:{...avatar,directorNote:dynamic.note,nativeReferencePatch:{originalImageUrls,referenceMap:map,originalDirectorNote,originalNarrationAudio,scaleSafeHeroUrl,productProfile:dynamic.profile,createdAt:new Date().toISOString()}}});
    temporaryProjectSaved=true;
    req.body={...(req.body||{}),projectId:temporaryProject.id,duration};
    const captured=createCaptureResponse();let nativeError=null;
    try{await nativeHandler(req,captured)}catch(error){nativeError=error}
    finally{restoredProject=await restoreOriginalState(user,projectId,originalImageUrls,map,originalDirectorNote,originalNarrationAudio).catch(error=>{console.error("[ad-film/avatar/pipeline/create-native-fixed:restore]",error);return null})}
    if(nativeError)throw nativeError;
    const payload=parseJson(captured._state.body);if(restoredProject&&payload&&typeof payload==="object"&&payload.project)payload.project=restoredProject;
    return sendJson(res,captured._state.statusCode||200,payload);
  }catch(error){
    if(temporaryProjectSaved&&user&&projectId&&originalImageUrls.length&&map&&!restoredProject)restoredProject=await restoreOriginalState(user,projectId,originalImageUrls,map,originalDirectorNote,originalNarrationAudio).catch(()=>null);
    console.error("[ad-film/avatar/pipeline/create-native-fixed]",error);
    return sendJson(res,Number(error?.status)||500,{ok:false,error:clean(error?.message||error,1200)||"native_reference_normalization_failed"});
  }
}
