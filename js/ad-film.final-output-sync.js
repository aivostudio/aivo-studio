/* AIVO AI Reklam Filmi — finalize and mount completed hybrid outputs */
(function AIVO_AD_FILM_FINAL_OUTPUT_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINAL_OUTPUT_SYNC_V2__)return;
  window.__AIVO_AD_FILM_FINAL_OUTPUT_SYNC_V2__=true;

  var flights=new Map();
  var timers=new Map();

  function clean(value){return String(value==null?"":value).trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(source){return clean(source&&source.id)}
  function pipeline(source){return source&&source.avatar&&source.avatar.pipeline||{}}
  function generation(source){return source&&source.generation||{}}
  function outputId(source){var gen=generation(source),pipe=pipeline(source);return clean(gen.outputId||gen.requestId||pipe.motion&&pipe.motion.requestId)}
  function sourceVideo(source){var gen=generation(source);return clean(gen.sourceVideoUrl||gen.videoUrl)}
  function sourceReady(source){return Boolean(sourceVideo(source))}
  function avatarReady(source){var pipe=pipeline(source);return clean(pipe.status).toLowerCase()==="completed"&&Boolean(clean(pipe.videoUrl))}
  function avatarFailed(source){var status=clean(pipeline(source).status).toLowerCase();return status==="failed"||status==="cancelled"||status==="canceled"}
  function finalOutputs(source){
    return (Array.isArray(source&&source.outputs)?source.outputs:[]).filter(function(item){
      return item&&clean(item.videoUrl)&&(
        Number(item.mixVersion||0)>=4||item.finalizedAt||item.avatarApplied===true||item.avatarIntegrated===true
      );
    });
  }
  function finalOutput(source){
    var list=finalOutputs(source);if(!list.length)return null;
    var active=clean(source&&source.activeOutputId);
    return list.find(function(item){return clean(item.id)===active})||list[0];
  }
  function needsFinalization(source){
    if(!source||source.avatar&&source.avatar.enabled!==true)return false;
    if(finalOutput(source))return false;
    var gen=generation(source),state=clean(source.status).toLowerCase();
    if(["failed","cancelled","canceled"].indexOf(state)>=0)return false;
    return sourceReady(source)&&avatarReady(source)&&(
      gen.awaitingFinalComposite===true||gen.finalizing===true||clean(gen.status).toLowerCase()==="processing"
    );
  }
  function dispatch(next){
    if(!next)return;
    window.AIVOAdFilmActiveProject=next;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{
      detail:{project:next,projectId:next.id||"",media:next.media||{}}
    }));
  }
  function mountSourceFallback(source){
    if(!sourceReady(source)||!avatarFailed(source)||finalOutput(source))return false;
    var url=sourceVideo(source),id=outputId(source);if(!url)return false;
    window.AIVOAdFilmGeneratedVideo=url;
    window.AIVOAdFilmActiveOutputId=id;
    if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function"){
      window.AIVOAdFilmResultControls.mount(url,"",{
        projectId:projectId(source),outputId:id,logoApplied:false,play:false,sourceFallback:true
      });
    }
    if(window.AIVOAdFilmLivePreviewState&&typeof window.AIVOAdFilmLivePreviewState.sync==="function")window.AIVOAdFilmLivePreviewState.sync(source);
    var scope=document.querySelector('[data-module-root][data-module="adfilm"]');
    var status=scope&&scope.querySelector('[data-adfilm-engine-status]');
    if(status){
      status.className="adfilm-engine-status is-visible is-warning";
      var title=status.querySelector("b"),detail=status.querySelector("small");
      var en=String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0;
      if(title)title.textContent=en?"Source video ready":"Kaynak video hazır";
      if(detail)detail.textContent=en?"Presenter processing failed; the completed cinematic video is shown below.":"Oyunculu sahne tamamlanamadı; biten sinematik video aşağıda gösteriliyor.";
    }
    return true;
  }
  function mount(source,play){
    var item=finalOutput(source);if(!item)return mountSourceFallback(source);
    var url=clean(item.videoUrl);if(!url)return mountSourceFallback(source);
    window.AIVOAdFilmGeneratedVideo=url;
    window.AIVOAdFilmActiveOutputId=clean(item.id);
    if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function"){
      window.AIVOAdFilmResultControls.mount(url,clean(item.logoUrl),{
        projectId:projectId(source),outputId:clean(item.id),logoApplied:!!item.logoApplied,play:!!play
      });
    }
    if(window.AIVOAdFilmLivePreviewState&&typeof window.AIVOAdFilmLivePreviewState.sync==="function")window.AIVOAdFilmLivePreviewState.sync(source);
    if(window.AIVOAdFilmOutputGallery&&typeof window.AIVOAdFilmOutputGallery.render==="function")window.AIVOAdFilmOutputGallery.render(source);
    if(window.AIVOAdFilmOutputWorkflow&&typeof window.AIVOAdFilmOutputWorkflow.render==="function")window.AIVOAdFilmOutputWorkflow.render(source);
    return true;
  }
  function schedule(source,delay){
    var id=projectId(source);if(!id)return;
    clearTimeout(timers.get(id));
    timers.set(id,setTimeout(function(){timers.delete(id);run(source)},Math.max(0,Number(delay)||0)));
  }
  async function run(source){
    source=source||project();
    var id=projectId(source);if(!id)return;
    if(mount(source,false))return;
    if(!needsFinalization(source))return;
    var key=id+"|"+outputId(source);
    if(flights.has(key))return flights.get(key);
    var task=(async function(){
      if(window.AIVOAdFilmSeedanceFinalizing)return;
      window.AIVOAdFilmSeedanceFinalizing=true;
      window.AIVOAdFilmFinalizationPending={projectId:id,outputId:outputId(source)};
      document.dispatchEvent(new CustomEvent("aivo:adfilm-finalization-pending",{detail:window.AIVOAdFilmFinalizationPending}));
      try{
        var response=await fetch("/api/ad-film/seedance/finalize",{
          method:"POST",credentials:"include",cache:"no-store",
          headers:{"Content-Type":"application/json",Accept:"application/json"},
          body:JSON.stringify({projectId:id,outputId:outputId(source)})
        });
        var data=await response.json().catch(function(){return{}});
        if(response.status===425){schedule(project(),2200);return}
        if(!response.ok||!data.project||!clean(data.video_url))throw new Error(clean(data.message||data.error)||"final_video_missing");
        window.AIVOAdFilmFinalizationPending=null;
        dispatch(data.project);
        mount(data.project,false);
      }catch(error){
        console.warn("[ADFILM] final output recovery",error);
        schedule(project(),3500);
      }finally{
        window.AIVOAdFilmSeedanceFinalizing=false;
      }
    })().finally(function(){flights.delete(key)});
    flights.set(key,task);
    return task;
  }

  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var next=event&&event.detail&&event.detail.project||project();
    if(next)window.AIVOAdFilmActiveProject=next;
    schedule(next,80);
  });
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(project(),420)});
  window.addEventListener("pageshow",function(){schedule(project(),220)});
  window.AIVOAdFilmFinalOutputSync={run:run,mount:mount,needsFinalization:needsFinalization,mountSourceFallback:mountSourceFallback};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(project(),300)},{once:true});else schedule(project(),300);
})();
