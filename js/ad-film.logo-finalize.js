/* AIVO AI Reklam Filmi — completed video transparent logo finalizer */
(function AIVO_AD_FILM_LOGO_FINALIZE(){
  "use strict";
  if(window.__AIVO_AD_FILM_LOGO_FINALIZE_V1__)return;
  window.__AIVO_AD_FILM_LOGO_FINALIZE_V1__=true;

  var busy=false;
  var lastKey="";
  var timer=null;

  var COPY={
    tr:{working:"Logo videoya ekleniyor",detail:"Şeffaf logo korunarak nihai video hazırlanıyor",done:"Logo videoya eklendi",failed:"Logo eklenemedi; logosuz video korunuyor"},
    en:{working:"Adding logo to video",detail:"Preparing the final video while preserving logo transparency",done:"Logo added to video",failed:"The logo could not be added; the original video is preserved"}
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
  function videoUrl(source,item){return clean(item&&item.videoUrl||source&&source.generation&&source.generation.videoUrl||window.AIVOAdFilmGeneratedVideo)}
  function setStage(mode,title,detail){
    var node=statusNode();
    if(!node)return;
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
    if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function"){
      window.AIVOAdFilmResultControls.mount(url,logo||"",{});
    }
  }
  async function fetchProject(id){
    var response=await fetch("/api/ad-film/project?id="+encodeURIComponent(id),{credentials:"include",cache:"no-store"});
    var data=await response.json().catch(function(){return{}});
    return response.ok&&data.project?data.project:null;
  }
  async function finalize(source){
    if(busy||!source||!source.id)return;
    var item=outputOf(source),logo=logoUrl(source,item),video=videoUrl(source,item);
    var completed=clean(source.status).toLowerCase()==="completed"||clean(source.generation&&source.generation.status).toLowerCase()==="completed";
    if(!completed||!video||!logo||item&&item.logoApplied||source.generation&&source.generation.logoApplied)return;
    var key=[source.id,item&&item.id||source.generation&&source.generation.outputId,video,logo].join("|");
    if(key===lastKey)return;
    lastKey=key;busy=true;
    setStage("busy",t("working"),t("detail"));
    try{
      var response=await fetch("/api/ad-film/seedance/finalize",{
        method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({projectId:source.id,outputId:item&&item.id||source.generation&&source.generation.outputId||""})
      });
      var data=await response.json().catch(function(){return{}});
      if(data.ok&&data.video_url){
        var next=data.project||await fetchProject(source.id)||source;
        dispatch(next);
        mount(data.video_url,logo);
        setStage("success",t("done"),"");
      }else{
        mount(data.video_url||video,logo);
        setStage("success",t("failed"),"");
      }
    }catch(error){
      console.warn("[ADFILM] logo finalization",error);
      mount(video,logo);
      setStage("success",t("failed"),"");
    }finally{busy=false}
  }
  async function check(){
    var scope=root();if(!scope)return;
    var source=project();
    if(source&&source.id){
      var item=outputOf(source),video=videoUrl(source,item),generationStatus=clean(source.generation&&source.generation.status).toLowerCase();
      if((generationStatus==="completed"||clean(source.status).toLowerCase()==="completed")&&video){finalize(source);return}
      if(window.AIVOAdFilmGeneratedVideo&&["queued","processing"].indexOf(generationStatus)>=0){
        var fresh=await fetchProject(source.id).catch(function(){return null});
        if(fresh){dispatch(fresh);finalize(fresh)}
      }
    }
  }
  function start(){clearInterval(timer);check();timer=setInterval(check,1800)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(start,900)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){setTimeout(function(){finalize(event&&event.detail&&event.detail.project||project())},250)});
  window.addEventListener("pagehide",function(){clearInterval(timer)});
  window.addEventListener("pageshow",function(){setTimeout(start,700)});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(start,700)},{once:true});else setTimeout(start,700);
})();
