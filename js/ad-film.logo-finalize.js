/* AIVO AI Reklam Filmi — completed video transparent logo finalizer */
(function AIVO_AD_FILM_LOGO_FINALIZE(){
  "use strict";
  if(window.__AIVO_AD_FILM_LOGO_FINALIZE_V3__)return;
  window.__AIVO_AD_FILM_LOGO_FINALIZE_V3__=true;

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
  function isApplied(source,item){return!!(item&&item.logoApplied||source&&source.generation&&source.generation.logoApplied)}
  function isCompleted(source){
    var projectStatus=clean(source&&source.status).toLowerCase();
    var generationStatus=clean(source&&source.generation&&source.generation.status).toLowerCase();
    return projectStatus==="completed"||generationStatus==="completed";
  }
  function generationRunning(){
    var scope=root();
    var button=scope&&scope.querySelector("[data-adfilm-build]");
    return!!(window.AIVOAdFilmSeedanceEngineActive||button&&button.classList.contains("is-generating"));
  }
  function stageKey(source,item,video,logo){return[source&&source.id,item&&item.id||source&&source.generation&&source.generation.outputId,video,logo].join("|")}
  function stateKey(source){
    var item=outputOf(source);
    return[
      source&&source.id,
      source&&source.activeOutputId,
      Array.isArray(source&&source.outputs)?source.outputs.length:0,
      item&&item.id,
      item&&item.videoUrl,
      item&&item.sourceVideoUrl,
      item&&item.logoApplied?"1":"0",
      source&&source.generation&&source.generation.status,
      source&&source.generation&&source.generation.outputId,
      source&&source.generation&&source.generation.videoUrl,
      source&&source.generation&&source.generation.logoApplied?"1":"0"
    ].join("|");
  }
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
  function dispatchIfChanged(source){
    if(!source)return;
    if(stateKey(source)===stateKey(project()))return;
    dispatch(source);
  }
  function mount(url,logo,applied){
    window.AIVOAdFilmGeneratedVideo=url||"";
    window.AIVOAdFilmGeneratedLogo=logo||"";
    if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function"){
      window.AIVOAdFilmResultControls.mount(url,applied?"":logo||"",{logoApplied:!!applied});
    }
  }
  async function fetchProject(id){
    var response=await fetch("/api/ad-film/project?id="+encodeURIComponent(id),{credentials:"include",cache:"no-store"});
    var data=await response.json().catch(function(){return{}});
    return response.ok&&data.project?data.project:null;
  }
  function retryDelay(count){return Math.min(90000,8000*Math.pow(2,Math.max(0,count-1)))}
  function schedule(delay){clearTimeout(timer);timer=setTimeout(check,delay==null?3500:delay)}

  async function finalize(source){
    if(busy||!source||!source.id)return;
    var item=outputOf(source),logo=logoUrl(source,item),video=videoUrl(source,item);
    if(!isCompleted(source)||!video||!logo||isApplied(source,item))return;

    var key=stageKey(source,item,video,logo);
    var retryAt=Number(nextRetryAt.get(key)||0);
    if(Date.now()<retryAt){schedule(Math.max(1200,retryAt-Date.now()));return}

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
        dispatchIfChanged(next);
        mount(data.video_url,logo,true);
        setStage("success",t("done"),"");
      }else{
        var count=Number(attempts.get(key)||0)+1;
        attempts.set(key,count);
        var delay=retryDelay(count);
        nextRetryAt.set(key,Date.now()+delay);
        setStage("busy",t("failed"),count<4?t("detail"):"");
        schedule(delay);
      }
    }catch(error){
      var count=Number(attempts.get(key)||0)+1;
      attempts.set(key,count);
      var delay=retryDelay(count);
      nextRetryAt.set(key,Date.now()+delay);
      console.warn("[ADFILM] logo finalization",error);
      setStage("busy",t("failed"),count<4?t("detail"):"");
      schedule(delay);
    }finally{busy=false}
  }

  async function check(){
    clearTimeout(timer);
    var scope=root();if(!scope)return;
    var source=project();if(!source||!source.id){schedule(5000);return}
    if(generationRunning()){schedule(2500);return}

    var fresh=await fetchProject(source.id).catch(function(){return null});
    if(fresh){dispatchIfChanged(fresh);source=fresh}

    var item=outputOf(source),video=videoUrl(source,item),logo=logoUrl(source,item);
    if(!isCompleted(source)||!video){schedule(3500);return}
    if(!logo||isApplied(source,item))return;
    finalize(source);
  }

  function start(delay){schedule(delay==null?700:delay)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")start(900)});
  document.addEventListener("aivo:adfilm-project-sync",function(){if(!busy)start(650)});
  window.addEventListener("pagehide",function(){clearTimeout(timer)});
  window.addEventListener("pageshow",function(){start(900)});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){start(900)},{once:true});else start(900);
})();
