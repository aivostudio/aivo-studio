/* AIVO AI Reklam Filmi — completed video transparent logo finalizer */
(function AIVO_AD_FILM_LOGO_FINALIZE(){
  "use strict";
  if(window.__AIVO_AD_FILM_LOGO_FINALIZE_V2__)return;
  window.__AIVO_AD_FILM_LOGO_FINALIZE_V2__=true;

  var busy=false;
  var timer=null;
  var attempts=new Map();
  var nextRetryAt=new Map();

  var COPY={
    tr:{working:"Logo videoya ekleniyor",detail:"Şeffaf logo korunarak nihai video hazırlanıyor",done:"Logo videoya eklendi",failed:"Logo henüz eklenemedi; yeniden denenecek"},
    en:{working:"Adding logo to video",detail:"Preparing the final video while preserving logo transparency",done:"Logo added to video",failed:"The logo could not be added yet; it will be retried"}
  };

  function lang(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0?"en":"tr"}
  function t(key){return COPY[lang()][key]||COPY.tr[key]||key}
  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function statusNode(){return root()&&root().querySelector("[data-adfilm-engine-status]")}
  function outputOf(source){
    source=source||{};
    var outputs=Array.isArray(source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[];
    var id=clean(source.activeOutputId||source.generation&&source.generation.outputId);
    return outputs.find(function(item){return clean(item.id)===id})||outputs[0]||null;
  }
  function logoUrl(source,item){return clean(source&&source.media&&source.media.logo&&source.media.logo.url||item&&item.logoUrl||source&&source.generation&&source.generation.logoUrl)}
  function videoUrl(source,item){return clean(item&&item.sourceVideoUrl||item&&item.videoUrl||source&&source.generation&&source.generation.sourceVideoUrl||source&&source.generation&&source.generation.videoUrl||window.AIVOAdFilmGeneratedVideo)}
  function stageKey(source,item,video,logo){return[source&&source.id,item&&item.id||source&&source.generation&&source.generation.outputId,video,logo].join("|")}
  function setStage(mode,title,detail){
    var node=statusNode();if(!node)return;
    node.className="adfilm-engine-status is-visible is-"+mode;
    var strong=node.querySelector("b"),small=node.querySelector("small");
    if(strong)strong.textContent=title||"";
    if(small)small.textContent=detail||"";
    var summary=root()&&root().querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');
    if(summary&&title)summary.textContent=title;
  }
  function dispatch(source){
    if(!source)return;
    window.AIVOAdFilmActiveProject=source;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:source,projectId:source.id||"",media:source.media||{}}}));
  }
  function mount(url,logo){
    window.AIVOAdFilmGeneratedVideo=url||"";
    window.AIVOAdFilmGeneratedLogo=logo||"";
    if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function")window.AIVOAdFilmResultControls.mount(url,logo||"",{});
  }
  async function fetchProject(id){
    var response=await fetch("/api/ad-film/project?id="+encodeURIComponent(id),{credentials:"include",cache:"no-store"});
    var data=await response.json().catch(function(){return{}});
    return response.ok&&data.project?data.project:null;
  }
  function retryDelay(count){return Math.min(90000,8000*Math.pow(2,Math.max(0,count-1)))}

  async function finalize(source){
    if(busy||!source||!source.id)return;
    var item=outputOf(source),logo=logoUrl(source,item),video=videoUrl(source,item);
    var completed=clean(source.status).toLowerCase()==="completed"||clean(source.generation&&source.generation.status).toLowerCase()==="completed";
    if(!completed||!video||!logo||item&&item.logoApplied||source.generation&&source.generation.logoApplied)return;

    var key=stageKey(source,item,video,logo);
    var retryAt=Number(nextRetryAt.get(key)||0);
    if(Date.now()<retryAt)return;

    busy=true;
    setStage("busy",t("working"),t("detail"));
    try{
      var response=await fetch("/api/ad-film/seedance/finalize",{
        method:"POST",
        credentials:"include",
        cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({projectId:source.id,outputId:item&&item.id||source.generation&&source.generation.outputId||""})
      });
      var data=await response.json().catch(function(){return{}});
      if(data.ok&&data.video_url&&data.logo_applied){
        attempts.delete(key);nextRetryAt.delete(key);
        var next=data.project||await fetchProject(source.id)||source;
        dispatch(next);mount(data.video_url,logo);setStage("success",t("done"),"");
      }else{
        var count=Number(attempts.get(key)||0)+1;
        attempts.set(key,count);
        nextRetryAt.set(key,Date.now()+retryDelay(count));
        mount(data.video_url||video,logo);
        setStage("busy",t("failed"),count<4?t("detail"):"");
      }
    }catch(error){
      var count=Number(attempts.get(key)||0)+1;
      attempts.set(key,count);
      nextRetryAt.set(key,Date.now()+retryDelay(count));
      console.warn("[ADFILM] logo finalization",error);
      mount(video,logo);setStage("busy",t("failed"),count<4?t("detail"):"");
    }finally{busy=false}
  }

  async function check(){
    var scope=root();if(!scope)return;
    var source=project();if(!source||!source.id)return;
    var fresh=await fetchProject(source.id).catch(function(){return null});
    if(fresh){source=fresh;dispatch(fresh)}
    var item=outputOf(source),video=videoUrl(source,item);
    var generationStatus=clean(source.generation&&source.generation.status).toLowerCase();
    var projectStatus=clean(source.status).toLowerCase();
    if((generationStatus==="completed"||projectStatus==="completed")&&video)finalize(source);
  }

  function start(){clearInterval(timer);check();timer=setInterval(check,3500)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(start,1000)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){setTimeout(function(){finalize(event&&event.detail&&event.detail.project||project())},350)});
  window.addEventListener("pagehide",function(){clearInterval(timer)});
  window.addEventListener("pageshow",function(){setTimeout(start,900)});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(start,900)},{once:true});else setTimeout(start,900);
})();
