/* AIVO AI Reklam Filmi — finalize and mount completed hybrid outputs */
(function AIVO_AD_FILM_FINAL_OUTPUT_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINAL_OUTPUT_SYNC_V3__)return;
  window.__AIVO_AD_FILM_FINAL_OUTPUT_SYNC_V3__=true;

  var flights=new Map();
  var timers=new Map();

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(source){return clean(source&&source.id)}
  function pipeline(source){return source&&source.avatar&&source.avatar.pipeline||{}}
  function generation(source){return source&&source.generation||{}}
  function finalization(source){var gen=generation(source);return source&&source.finalization||gen.finalization||{}}
  function outputId(source){var gen=generation(source),pipe=pipeline(source);return clean(gen.outputId||gen.requestId||pipe.motion&&pipe.motion.requestId)}
  function sourceReady(source){var gen=generation(source);return Boolean(clean(gen.sourceVideoUrl||gen.videoUrl))}
  function avatarReady(source){var pipe=pipeline(source);return lower(pipe.status)==="completed"&&Boolean(clean(pipe.videoUrl))}
  function terminal(source){
    var states=[
      source&&source.status,
      generation(source).status,
      pipeline(source).status,
      finalization(source).status
    ].map(lower);
    return states.some(function(state){return ["failed","error","cancelled","canceled"].indexOf(state)>=0});
  }
  function isFinalOutput(item){
    return Boolean(item&&clean(item.videoUrl)&&(
      Number(item.mixVersion||0)>=4||
      item.finalizedAt||
      item.avatarApplied===true||
      item.avatarIntegrated===true||
      item.hybridTimeline===true||
      clean(item.avatarCompositeMode)
    ));
  }
  function finalOutputs(source){
    return (Array.isArray(source&&source.outputs)?source.outputs:[]).filter(isFinalOutput);
  }
  function finalOutput(source){
    var list=finalOutputs(source);if(!list.length)return null;
    var active=clean(source&&source.activeOutputId);
    return list.find(function(item){return clean(item.id)===active})||list[0];
  }
  function needsFinalization(source){
    if(!source||source.avatar&&source.avatar.enabled!==true||terminal(source))return false;
    if(finalOutput(source))return false;
    var gen=generation(source);
    return sourceReady(source)&&avatarReady(source)&&(
      gen.awaitingFinalComposite===true||gen.finalizing===true||lower(gen.status)==="processing"
    );
  }
  function dispatch(next){
    if(!next)return;
    window.AIVOAdFilmActiveProject=next;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{
      detail:{project:next,projectId:next.id||"",media:next.media||{}}
    }));
  }
  function mount(source,play){
    var item=finalOutput(source);if(!item)return false;
    var url=clean(item.videoUrl);if(!url)return false;
    window.AIVOAdFilmGeneratedVideo=url;
    window.AIVOAdFilmActiveOutputId=clean(item.id);
    if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function"){
      window.AIVOAdFilmResultControls.mount(url,clean(item.logoUrl),{
        projectId:projectId(source),outputId:clean(item.id),logoApplied:!!item.logoApplied,play:!!play,source:"final-output"
      });
    }
    if(window.AIVOAdFilmLivePreviewState&&typeof window.AIVOAdFilmLivePreviewState.sync==="function")window.AIVOAdFilmLivePreviewState.sync(source);
    if(window.AIVOAdFilmOutputGallery&&typeof window.AIVOAdFilmOutputGallery.render==="function")window.AIVOAdFilmOutputGallery.render(source);
    if(window.AIVOAdFilmOutputWorkflow&&typeof window.AIVOAdFilmOutputWorkflow.render==="function")window.AIVOAdFilmOutputWorkflow.render(source);
    return true;
  }
  function clearPartialPreview(source){
    if(finalOutput(source))return;
    if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.clear==="function")window.AIVOAdFilmResultControls.clear();
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
    if(terminal(source)){clearPartialPreview(source);return}
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
  window.AIVOAdFilmFinalOutputSync={run:run,mount:mount,needsFinalization:needsFinalization,finalOutputs:finalOutputs};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(project(),300)},{once:true});else schedule(project(),300);
})();
