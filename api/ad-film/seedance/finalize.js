// api/ad-film/seedance/finalize.js
export const config = { runtime: "nodejs" };
export const maxDuration = 300;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { putObject } from "../../_lib/r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const MIX_VERSION = 8;
const DOWNLOAD_TIMEOUT_MS = 70000;
const FFMPEG_TIMEOUT_MS = 150000;
const UPLOAD_TIMEOUT_MS = 70000;

function clean(value,max=1600){return String(value??"").trim().slice(0,max)}
function safePart(value,fallback="output"){const next=clean(value,180).replace(/[^a-z0-9._-]+/gi,"-").replace(/^-+|-+$/g,"");return next||fallback}
function runFfmpeg(args){return new Promise((resolve,reject)=>{const child=spawn(ffmpegPath,args,{stdio:["ignore","ignore","pipe"]});let stderr="",settled=false;const timer=setTimeout(()=>{if(settled)return;settled=true;child.kill("SIGKILL");reject(new Error("ffmpeg_timeout"))},FFMPEG_TIMEOUT_MS);child.stderr.on("data",c=>{stderr+=c.toString();if(stderr.length>24000)stderr=stderr.slice(-24000)});child.on("error",error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)});child.on("close",code=>{if(settled)return;settled=true;clearTimeout(timer);code===0?resolve():reject(new Error(stderr||`ffmpeg_failed:${code}`))})})}
async function download(url,destination,maxBytes=180*1024*1024){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),DOWNLOAD_TIMEOUT_MS);try{const response=await fetch(url,{method:"GET",cache:"no-store",redirect:"follow",signal:controller.signal});if(!response.ok||!response.body)throw new Error(`download_failed:${response.status}`);const length=Number(response.headers.get("content-length")||0);if(length>maxBytes)throw new Error("invalid_download_size");let received=0;const meter=new TransformStream({transform(chunk,writer){received+=chunk.byteLength||chunk.length||0;if(received>maxBytes)throw new Error("invalid_download_size");writer.enqueue(chunk)}});await pipeline(Readable.fromWeb(response.body.pipeThrough(meter)),fs.createWriteStream(destination));if(received<=0)throw new Error("invalid_download_size")}catch(error){if(error?.name==="AbortError")throw new Error("download_timeout");throw error}finally{clearTimeout(timer)}}
function outputsOf(project){const outputs=Array.isArray(project?.outputs)?project.outputs.filter(item=>item&&item.videoUrl):[];if(!outputs.length&&(project?.generation?.videoUrl||project?.generation?.sourceVideoUrl))outputs.push({id:project.generation.outputId||project.generation.requestId,requestId:project.generation.requestId||null,version:project.generation.version||1,videoUrl:project.generation.videoUrl||project.generation.sourceVideoUrl,sourceVideoUrl:project.generation.sourceVideoUrl||project.generation.videoUrl||null,logoUrl:project.generation.logoUrl||project?.media?.logo?.url||null,completedAt:project.generation.completedAt||project.updatedAt,duration:project.generation.input?.duration||project?.output?.duration||"15",aspectRatio:project.generation.input?.aspectRatio||project?.output?.aspectRatio||"9:16",resolution:project.generation.input?.resolution||project?.output?.quality||"1080p"});return outputs.slice(0,30)}
function logoWidth(resolution){const v=clean(resolution,20).toLowerCase();if(v==="4k")return 300;if(v==="720p")return 128;if(v==="480p")return 90;return 178}
function logoMargin(resolution){const v=clean(resolution,20).toLowerCase();if(v==="4k")return 72;if(v==="720p")return 28;if(v==="480p")return 20;return 40}
function isNearBlack(r,g,b){const max=Math.max(r,g,b),min=Math.min(r,g,b);return max<=42&&max-min<=20}
function durationSeconds(target,project){const value=Number.parseFloat(target?.duration||project?.generation?.input?.duration||project?.output?.duration||15);return Number.isFinite(value)?Math.max(4,Math.min(20,value)):15}
function introDelayMs(duration){if(duration>=12)return 1400;if(duration>=8)return 1000;return 650}
function avatarWindows(duration){if(duration<=6)return[[Math.min(.7,duration*.15),Math.max(1.8,duration-1.0)]];if(duration<=10)return[[1.0,Math.min(4.2,duration*.48)],[Math.min(6.0,duration*.64),Math.max(6.8,duration-1.0)]];return[[1.2,Math.min(5.2,duration*.38)],[Math.min(8.4,duration*.62),Math.min(duration-1.2,12.7)]]}
function avatarEnableExpression(duration){return avatarWindows(duration).filter(pair=>pair[1]>pair[0]).map(pair=>`between(t,${pair[0].toFixed(2)},${pair[1].toFixed(2)})`).join("+")||"0"}
async function prepareTransparentLogo(inputPath,outputPath){const{data,info}=await sharp(inputPath).ensureAlpha().raw().toBuffer({resolveWithObject:true});const{width,height,channels}=info,visited=new Uint8Array(width*height),queue=new Int32Array(width*height);let head=0,tail=0;function enqueue(x,y){if(x<0||y<0||x>=width||y>=height)return;const index=y*width+x;if(visited[index])return;const offset=index*channels;if(!isNearBlack(data[offset],data[offset+1],data[offset+2]))return;visited[index]=1;queue[tail++]=index}for(let x=0;x<width;x++){enqueue(x,0);enqueue(x,height-1)}for(let y=0;y<height;y++){enqueue(0,y);enqueue(width-1,y)}while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);enqueue(x-1,y);enqueue(x+1,y);enqueue(x,y-1);enqueue(x,y+1)}for(let i=0;i<visited.length;i++)if(visited[i])data[i*channels+3]=0;await sharp(data,{raw:info}).trim({background:{r:0,g:0,b:0,alpha:0}}).png().toFile(outputPath)}
function musicUrlOf(project){const mode=project?.music?.mode||"auto";if(mode==="off")return"";if(mode==="upload")return clean(project?.media?.musicTrack?.url,4000);return clean(project?.music?.audio?.url,4000)}

export default async function handler(req,res){
  const cleanup=[];let sourceVideoUrl="";
  try{
    if(req.method!=="POST"){res.setHeader("Allow","POST");return sendJson(res,405,{ok:false,error:"method_not_allowed"})}
    const user=await resolveAdFilmUser(req);if(!user)return sendJson(res,401,{ok:false,error:"unauthorized"});
    const projectId=clean(req.body?.projectId,120),requestedOutputId=clean(req.body?.outputId,240);if(!projectId)return sendJson(res,400,{ok:false,error:"missing_project_id"});
    const project=await getOwnedProject(user,projectId);if(!project)return sendJson(res,404,{ok:false,error:"project_not_found"});
    const outputs=outputsOf(project);const target=outputs.find(item=>clean(item.id)===requestedOutputId)||outputs.find(item=>clean(item.id)===clean(project.activeOutputId))||outputs[0]||null;
    sourceVideoUrl=clean(target?.sourceVideoUrl||target?.videoUrl||project?.generation?.sourceVideoUrl||project?.generation?.videoUrl,4000);
    const logoUrl=clean(project?.media?.logo?.url||target?.logoUrl||project?.generation?.logoUrl,4000);
    const narrationEnabled=project?.narration?.enabled!==false,narrationAudio=project?.narration?.audio;
    const narrationUrl=narrationEnabled&&narrationAudio?.approved===true?clean(narrationAudio.url,4000):"";
    const musicUrl=musicUrlOf(project),musicRequired=(project?.music?.mode||"auto")!=="off";
    const avatarEnabled=project?.avatar?.enabled===true;
    const avatarUrl=avatarEnabled?clean(project?.avatar?.pipeline?.videoUrl||project?.avatar?.videoUrl,4000):"";
    if(!sourceVideoUrl)return sendJson(res,409,{ok:false,error:"missing_source_video"});
    if(narrationEnabled&&!narrationUrl)return sendJson(res,409,{ok:false,error:"narration_audio_approval_required"});
    if(musicRequired&&!musicUrl)return sendJson(res,409,{ok:false,error:"music_audio_required"});
    if(avatarEnabled&&!avatarUrl)return sendJson(res,409,{ok:false,error:"avatar_video_required"});
    const logoSatisfied=!logoUrl||target?.logoApplied===true,narrationSatisfied=!narrationEnabled||target?.narrationApplied===true,musicSatisfied=!musicRequired||target?.musicApplied===true,avatarSatisfied=!avatarEnabled||target?.avatarApplied===true,mixSatisfied=Number(target?.mixVersion||0)>=MIX_VERSION;
    if(target?.videoUrl&&logoSatisfied&&narrationSatisfied&&musicSatisfied&&avatarSatisfied&&mixSatisfied)return sendJson(res,200,{ok:true,projectId,outputId:target.id,video_url:target.videoUrl,logo_applied:!!logoUrl,narration_applied:!!narrationUrl,music_applied:!!musicUrl,avatar_applied:!!avatarUrl,mix_version:target.mixVersion,project});

    const resolution=target?.resolution||project?.generation?.input?.resolution||project?.output?.quality||"1080p",width=logoWidth(resolution),margin=logoMargin(resolution),outputId=clean(target?.id||project?.generation?.outputId||project?.generation?.requestId,240),version=Number.parseInt(target?.version||project?.generation?.version,10)||1;
    const duration=durationSeconds(target,project),voiceDelay=narrationUrl&&musicUrl?introDelayMs(duration):0,fadeOutStart=Math.max(0.5,duration-0.8).toFixed(2);
    const tmpDir=fs.mkdtempSync(path.join(os.tmpdir(),"aivo-adfilm-final-")),inputVideo=path.join(tmpDir,"source.mp4"),avatarVideo=path.join(tmpDir,"avatar.mp4"),originalLogo=path.join(tmpDir,"logo-original"),transparentLogo=path.join(tmpDir,"logo-transparent.png"),narrationFile=path.join(tmpDir,"narration-audio"),musicFile=path.join(tmpDir,"music-audio"),outputVideo=path.join(tmpDir,"final.mp4");cleanup.push(outputVideo,musicFile,narrationFile,transparentLogo,originalLogo,avatarVideo,inputVideo,tmpDir);

    const jobs=[download(sourceVideoUrl,inputVideo)];
    if(avatarUrl)jobs.push(download(avatarUrl,avatarVideo,180*1024*1024));
    if(logoUrl)jobs.push(download(logoUrl,originalLogo,20*1024*1024));
    if(narrationUrl)jobs.push(download(narrationUrl,narrationFile,30*1024*1024));
    if(musicUrl)jobs.push(download(musicUrl,musicFile,80*1024*1024));
    await Promise.all(jobs);
    if(logoUrl)await prepareTransparentLogo(originalLogo,transparentLogo);

    const args=["-y","-hide_banner","-loglevel","error","-i",inputVideo];let nextIndex=1,avatarIndex=-1,logoIndex=-1,narrationIndex=-1,musicIndex=-1;if(avatarUrl){avatarIndex=nextIndex++;args.push("-i",avatarVideo)}if(logoUrl){logoIndex=nextIndex++;args.push("-loop","1","-i",transparentLogo)}if(narrationUrl){narrationIndex=nextIndex++;args.push("-i",narrationFile)}if(musicUrl){musicIndex=nextIndex++;args.push("-stream_loop","-1","-i",musicFile)}
    const filters=[];let videoLabel="0:v";
    if(avatarUrl){filters.push(`[${avatarIndex}:v][0:v]scale2ref=w=main_w:h=main_h:flags=fast_bilinear[avatar_scaled][product_base]`);filters.push(`[product_base]setpts=PTS-STARTPTS[product_timed]`);filters.push(`[avatar_scaled]setpts=PTS-STARTPTS[avatar_timed]`);filters.push(`[product_timed][avatar_timed]overlay=0:0:enable='${avatarEnableExpression(duration)}':eof_action=pass:shortest=0[hybrid]`);videoLabel="hybrid"}
    if(logoUrl){filters.push(`[${logoIndex}:v]scale=${width}:-1:flags=fast_bilinear,format=rgba,colorchannelmixer=aa=0.96[logo]`);filters.push(`[${videoLabel}][logo]overlay=W-w-${margin}:H-h-${margin}:format=auto:shortest=1[vout]`);videoLabel="vout"}
    if(narrationUrl&&musicUrl){filters.push(`[${narrationIndex}:a]aresample=48000,volume=1.02,adelay=${voiceDelay}|${voiceDelay},apad=pad_dur=30,asplit=2[voice_sc][voice_mix]`);filters.push(`[${musicIndex}:a]aresample=48000,volume=0.78,afade=t=in:st=0:d=0.18,afade=t=out:st=${fadeOutStart}:d=0.8,apad=pad_dur=30[music]`);filters.push(`[music][voice_sc]sidechaincompress=threshold=0.045:ratio=3.0:attack=15:release=310:makeup=1[ducked]`);filters.push(`[ducked][voice_mix]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.985[aout]`)}else if(narrationUrl){filters.push(`[${narrationIndex}:a]aresample=48000,volume=1.02,apad=pad_dur=30,alimiter=limit=0.985[aout]`)}else if(musicUrl){filters.push(`[${musicIndex}:a]aresample=48000,volume=0.92,afade=t=in:st=0:d=0.18,afade=t=out:st=${fadeOutStart}:d=0.8,apad=pad_dur=30,alimiter=limit=0.985[aout]`)}
    if(!avatarUrl&&!logoUrl&&filters.length){filters.push("[0:v]null[vsource]");videoLabel="vsource"}
    if(filters.length)args.push("-filter_complex",filters.join(";"));args.push("-map",filters.length?`[${videoLabel}]`:"0:v:0");if(narrationUrl||musicUrl)args.push("-map","[aout]");else args.push("-map","0:a:0?");args.push("-t",String(duration),"-c:v","libx264","-preset","ultrafast","-crf",resolution==="4k"?"23":"20","-pix_fmt","yuv420p","-threads","2","-c:a","aac","-b:a","256k","-ar","48000","-ac","2","-shortest","-movflags","+faststart",outputVideo);await runFfmpeg(args);

    const key=`${mediaPrefix(user,projectId)}outputs/seedance/${safePart(outputId,"video")}-v${version}-final-${Date.now()}.mp4`;
    const uploadController=new AbortController();const uploadTimer=setTimeout(()=>uploadController.abort(),UPLOAD_TIMEOUT_MS);let finalUrl;try{const stat=fs.statSync(outputVideo);finalUrl=await putObject({key,body:fs.createReadStream(outputVideo),contentLength:stat.size,abortSignal:uploadController.signal,contentType:"video/mp4",cacheControl:"public, max-age=31536000, immutable",contentDisposition:"inline"})}catch(error){if(error?.name==="AbortError")throw new Error("r2_upload_timeout");throw error}finally{clearTimeout(uploadTimer)}
    const now=new Date().toISOString();
    const finalOutput={...(target||{}),id:outputId||target?.id||project?.generation?.requestId,version,sourceVideoUrl,videoUrl:finalUrl,logoUrl:logoUrl||null,logoApplied:!!logoUrl,logoPosition:logoUrl?"bottom-right":null,logoOpacity:logoUrl?0.96:null,narrationUrl:narrationUrl||null,narrationApplied:!!narrationUrl,narrationMastered:narrationAudio?.mastered===true,narrationApprovedAt:narrationAudio?.approvedAt||null,narrationDelayMs:voiceDelay,musicUrl:musicUrl||null,musicApplied:!!musicUrl,musicMode:project?.music?.mode||"auto",musicBedVolume:narrationUrl&&musicUrl?0.78:0.92,avatarUrl:avatarUrl||null,avatarApplied:!!avatarUrl,avatarWindows:avatarUrl?avatarWindows(duration):[],avatarPipelineVersion:avatarUrl?Number(project?.avatar?.pipeline?.version||1):null,audioCodec:"aac",audioBitrate:"256k",mixVersion:MIX_VERSION,finalizedAt:now};
    const nextOutputs=[finalOutput,...outputs.filter(item=>clean(item.id)!==clean(finalOutput.id))].slice(0,30);const nextProject=await saveProject(user,{...project,status:"completed",outputs:nextOutputs,activeOutputId:finalOutput.id,generation:{...(project.generation||{}),status:"completed",outputId:finalOutput.id,sourceVideoUrl,videoUrl:finalUrl,logoUrl:logoUrl||null,logoApplied:!!logoUrl,narrationUrl:narrationUrl||null,narrationApplied:!!narrationUrl,narrationDelayMs:voiceDelay,musicUrl:musicUrl||null,musicApplied:!!musicUrl,musicBedVolume:narrationUrl&&musicUrl?0.78:0.92,avatarUrl:avatarUrl||null,avatarApplied:!!avatarUrl,avatarWindows:avatarUrl?avatarWindows(duration):[],audioCodec:"aac",audioBitrate:"256k",mixVersion:MIX_VERSION,finalizedAt:now,completedAt:project?.generation?.completedAt||now,error:null}});
    return sendJson(res,200,{ok:true,projectId,outputId:finalOutput.id,video_url:finalUrl,source_video_url:sourceVideoUrl,logo_url:logoUrl||null,logo_applied:!!logoUrl,narration_url:narrationUrl||null,narration_applied:!!narrationUrl,narration_delay_ms:voiceDelay,music_url:musicUrl||null,music_applied:!!musicUrl,avatar_url:avatarUrl||null,avatar_applied:!!avatarUrl,avatar_windows:avatarUrl?avatarWindows(duration):[],audio_codec:"aac",audio_bitrate:"256k",mix_version:MIX_VERSION,project:nextProject,outputs:nextProject.outputs||[],activeOutputId:nextProject.activeOutputId||finalOutput.id});
  }catch(error){console.error("[ad-film/seedance/finalize]",error);return sendJson(res,500,{ok:false,error:"adfilm_finalize_failed",message:String(error?.message||error).slice(0,1200),video_url:sourceVideoUrl||null})}finally{for(const entry of cleanup.reverse()){try{if(!entry||!fs.existsSync(entry))continue;if(fs.statSync(entry).isDirectory())fs.rmSync(entry,{recursive:true,force:true});else fs.unlinkSync(entry)}catch(_){}}}
}
