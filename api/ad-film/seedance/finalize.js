// api/ad-film/seedance/finalize.js
export const config = { runtime: "nodejs" };
export const maxDuration = 300;

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
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

function clean(value,max=1600){return String(value??"").trim().slice(0,max)}
function safePart(value,fallback="output"){const next=clean(value,180).replace(/[^a-z0-9._-]+/gi,"-").replace(/^-+|-+$/g,"");return next||fallback}
function runFfmpeg(args){return new Promise((resolve,reject)=>{const child=spawn(ffmpegPath,args,{stdio:["ignore","ignore","pipe"]});let stderr="";child.stderr.on("data",c=>{stderr+=c.toString();if(stderr.length>24000)stderr=stderr.slice(-24000)});child.on("error",reject);child.on("close",code=>code===0?resolve():reject(new Error(stderr||`ffmpeg_failed:${code}`)))})}
async function download(url,destination,maxBytes=180*1024*1024){const response=await fetch(url,{method:"GET",cache:"no-store",redirect:"follow"});if(!response.ok)throw new Error(`download_failed:${response.status}`);const body=Buffer.from(await response.arrayBuffer());if(!body.length||body.length>maxBytes)throw new Error("invalid_download_size");fs.writeFileSync(destination,body)}
function outputsOf(project){const outputs=Array.isArray(project?.outputs)?project.outputs.filter(item=>item&&item.videoUrl):[];if(!outputs.length&&project?.generation?.videoUrl)outputs.push({id:project.generation.outputId||project.generation.requestId,requestId:project.generation.requestId||null,version:project.generation.version||1,videoUrl:project.generation.videoUrl,sourceVideoUrl:project.generation.sourceVideoUrl||null,logoUrl:project.generation.logoUrl||project?.media?.logo?.url||null,completedAt:project.generation.completedAt||project.updatedAt,duration:project.generation.input?.duration||project?.output?.duration||"15",aspectRatio:project.generation.input?.aspectRatio||project?.output?.aspectRatio||"9:16",resolution:project.generation.input?.resolution||project?.output?.quality||"1080p"});return outputs.slice(0,30)}
function logoWidth(resolution){const v=clean(resolution,20).toLowerCase();if(v==="4k")return 300;if(v==="720p")return 128;if(v==="480p")return 90;return 178}
function logoMargin(resolution){const v=clean(resolution,20).toLowerCase();if(v==="4k")return 72;if(v==="720p")return 28;if(v==="480p")return 20;return 40}
function isNearBlack(r,g,b){const max=Math.max(r,g,b),min=Math.min(r,g,b);return max<=42&&max-min<=20}
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
    if(!sourceVideoUrl)return sendJson(res,409,{ok:false,error:"missing_source_video"});
    if(narrationEnabled&&!narrationUrl)return sendJson(res,409,{ok:false,error:"narration_audio_approval_required"});
    if(musicRequired&&!musicUrl)return sendJson(res,409,{ok:false,error:"music_audio_required"});
    const logoSatisfied=!logoUrl||target?.logoApplied===true,narrationSatisfied=!narrationEnabled||target?.narrationApplied===true,musicSatisfied=!musicRequired||target?.musicApplied===true;
    if(target?.videoUrl&&logoSatisfied&&narrationSatisfied&&musicSatisfied)return sendJson(res,200,{ok:true,projectId,outputId:target.id,video_url:target.videoUrl,logo_applied:!!logoUrl,narration_applied:!!narrationUrl,music_applied:!!musicUrl,project});

    const resolution=target?.resolution||project?.generation?.input?.resolution||project?.output?.quality||"1080p",width=logoWidth(resolution),margin=logoMargin(resolution),outputId=clean(target?.id||project?.generation?.outputId||project?.generation?.requestId,240),version=Number.parseInt(target?.version||project?.generation?.version,10)||1;
    const tmpDir=fs.mkdtempSync(path.join(os.tmpdir(),"aivo-adfilm-final-")),inputVideo=path.join(tmpDir,"source.mp4"),originalLogo=path.join(tmpDir,"logo-original"),transparentLogo=path.join(tmpDir,"logo-transparent.png"),narrationFile=path.join(tmpDir,"narration-audio"),musicFile=path.join(tmpDir,"music-audio"),outputVideo=path.join(tmpDir,"final.mp4");cleanup.push(outputVideo,musicFile,narrationFile,transparentLogo,originalLogo,inputVideo,tmpDir);
    await download(sourceVideoUrl,inputVideo);if(logoUrl){await download(logoUrl,originalLogo,20*1024*1024);await prepareTransparentLogo(originalLogo,transparentLogo)}if(narrationUrl)await download(narrationUrl,narrationFile,30*1024*1024);if(musicUrl)await download(musicUrl,musicFile,50*1024*1024);
    const args=["-y","-i",inputVideo];let nextIndex=1,logoIndex=-1,narrationIndex=-1,musicIndex=-1;if(logoUrl){logoIndex=nextIndex++;args.push("-loop","1","-i",transparentLogo)}if(narrationUrl){narrationIndex=nextIndex++;args.push("-i",narrationFile)}if(musicUrl){musicIndex=nextIndex++;args.push("-stream_loop","-1","-i",musicFile)}
    const filters=[];if(logoUrl){filters.push(`[${logoIndex}:v]scale=${width}:-1:flags=lanczos,format=rgba,colorchannelmixer=aa=0.96[logo]`);filters.push(`[0:v][logo]overlay=W-w-${margin}:H-h-${margin}:format=auto:shortest=1[vout]`)}

    /* A filter output can only be consumed once. When music ducking is active,
       split the approved narration into one sidechain signal and one audible
       mix signal. The previous graph consumed [voice] twice and FFmpeg aborted,
       leaving the user with the silent Seedance source video. */
    if(narrationUrl&&musicUrl){
      filters.push(`[${narrationIndex}:a]aresample=48000,volume=1.08,apad=pad_dur=60,asplit=2[voice_sc][voice_mix]`);
      filters.push(`[${musicIndex}:a]aresample=48000,highpass=f=35,lowpass=f=15500,volume=0.28,apad=pad_dur=60[music]`);
      filters.push(`[music][voice_sc]sidechaincompress=threshold=0.025:ratio=7:attack=18:release=320:makeup=1[ducked]`);
      filters.push(`[ducked][voice_mix]amix=inputs=2:duration=longest:dropout_transition=0,alimiter=limit=0.96[aout]`);
    }else if(narrationUrl){
      filters.push(`[${narrationIndex}:a]aresample=48000,volume=1.08,apad=pad_dur=60,alimiter=limit=0.96[aout]`);
    }else if(musicUrl){
      filters.push(`[${musicIndex}:a]aresample=48000,highpass=f=35,lowpass=f=15500,volume=0.48,apad=pad_dur=60,alimiter=limit=0.96[aout]`);
    }

    if(filters.length)args.push("-filter_complex",filters.join(";"));args.push("-map",logoUrl?"[vout]":"0:v:0");if(narrationUrl||musicUrl)args.push("-map","[aout]");else args.push("-map","0:a:0?");args.push("-c:v","libx264","-preset","ultrafast","-crf","18","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-ar","48000","-ac","2","-shortest","-movflags","+faststart",outputVideo);await runFfmpeg(args);
    const key=`${mediaPrefix(user,projectId)}outputs/seedance/${safePart(outputId,"video")}-v${version}-final-${Date.now()}.mp4`;const finalUrl=await putObject({key,body:fs.readFileSync(outputVideo),contentType:"video/mp4",cacheControl:"public, max-age=31536000, immutable",contentDisposition:"inline"});const now=new Date().toISOString();
    const finalOutput={...(target||{}),id:outputId||target?.id||project?.generation?.requestId,version,sourceVideoUrl,videoUrl:finalUrl,logoUrl:logoUrl||null,logoApplied:!!logoUrl,logoPosition:logoUrl?"bottom-right":null,logoOpacity:logoUrl?0.96:null,narrationUrl:narrationUrl||null,narrationApplied:!!narrationUrl,narrationMastered:narrationAudio?.mastered===true,narrationApprovedAt:narrationAudio?.approvedAt||null,musicUrl:musicUrl||null,musicApplied:!!musicUrl,musicMode:project?.music?.mode||"auto",mixVersion:3,finalizedAt:now};
    const nextOutputs=[finalOutput,...outputs.filter(item=>clean(item.id)!==clean(finalOutput.id))].slice(0,30);const nextProject=await saveProject(user,{...project,status:"completed",outputs:nextOutputs,activeOutputId:finalOutput.id,generation:{...(project.generation||{}),status:"completed",outputId:finalOutput.id,sourceVideoUrl,videoUrl:finalUrl,logoUrl:logoUrl||null,logoApplied:!!logoUrl,narrationUrl:narrationUrl||null,narrationApplied:!!narrationUrl,musicUrl:musicUrl||null,musicApplied:!!musicUrl,mixVersion:3,finalizedAt:now,completedAt:project?.generation?.completedAt||now,error:null}});
    return sendJson(res,200,{ok:true,projectId,outputId:finalOutput.id,video_url:finalUrl,source_video_url:sourceVideoUrl,logo_url:logoUrl||null,logo_applied:!!logoUrl,narration_url:narrationUrl||null,narration_applied:!!narrationUrl,music_url:musicUrl||null,music_applied:!!musicUrl,project:nextProject,outputs:nextProject.outputs||[],activeOutputId:nextProject.activeOutputId||finalOutput.id});
  }catch(error){console.error("[ad-film/seedance/finalize]",error);return sendJson(res,500,{ok:false,error:"adfilm_finalize_failed",message:String(error?.message||error).slice(0,1200),video_url:sourceVideoUrl||null})}finally{for(const entry of cleanup.reverse()){try{if(!entry||!fs.existsSync(entry))continue;if(fs.statSync(entry).isDirectory())fs.rmSync(entry,{recursive:true,force:true});else fs.unlinkSync(entry)}catch(_){}}}
}
